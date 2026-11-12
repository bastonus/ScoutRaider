"""
FastAPI Server Application for ScoutRaider Engine.
Exposes REST APIs for:
  - User accounts (PostgreSQL/Coolify auth, registration, login, sessions)
  - Automatic cloud project synchronization & persistence
  - Module management, validation & secure ZIP upload
  - Probabilistic CSP diffraction solver
  - High-precision WeasyPrint HTML/CSS Paged Media PDF generation
  - Production SPA static hosting
"""

import os
import json
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, HTTPException, Response, Query, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from . import db, auth
from .modules.schema import ModuleMetadata, EncodedOutput
from .modules.registry import ModuleRegistry, SecurityError
from .diffraction.models import ItinerarySegment, PresetConfig, DiffractionResult
from .diffraction.presets import BUILTIN_PRESETS
from .diffraction.solver import DiffractionSolver
from .renderer.models import CarnetRenderOptions, StepRenderBlock
from .renderer.service import WeasyPrintRenderService
from .renderer.inspector import PDFLayoutInspector

logger = logging.getLogger("scoutraider")

PROJECT_ROOT = Path(__file__).resolve().parents[2]
LEGACY_MODULES_DIR = PROJECT_ROOT / "legacy" / "modules"
STORAGE_DIR = Path(__file__).parent / "storage"

registry = ModuleRegistry(modules_dir=str(STORAGE_DIR / "modules"))
if LEGACY_MODULES_DIR.exists():
    registry.load_from_base_dir(LEGACY_MODULES_DIR)

render_service = WeasyPrintRenderService()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize DB
    logger.info("Initializing database connection...")
    await db.init_db()
    yield
    # Shutdown logic if any


app = FastAPI(
    title="ScoutRaider Suite Core Engine & Cloud API",
    description="Backend engine for accounts, cloud auto-save, module orchestration, and WeasyPrint compilation.",
    version="1.1.0",
    lifespan=lifespan
)

# Enable CORS for web client, Coolify domain and Electron
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Health ───────────────────────────────────────────────────────────────────

@app.get("/health", tags=["System"])
def health_check():
    return {
        "status": "ok",
        "engine": "ScoutRaider-Backend",
        "db_mode": "sqlite" if db._use_sqlite else "postgresql",
        "loaded_modules_count": len(registry.list_all())
    }


# ─── Auth Models & Endpoints ──────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    username: str
    password: str
    email: Optional[str] = None


class LoginRequest(BaseModel):
    username_or_email: str
    password: str


@app.post("/api/auth/register", tags=["Auth"])
async def register(payload: RegisterRequest):
    username = payload.username.strip()
    if len(username) < 3:
        raise HTTPException(status_code=400, detail="Le nom d'utilisateur doit comporter au moins 3 caractères.")
    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Le mot de passe doit comporter au moins 6 caractères.")

    existing_user = await db.get_user_by_username(username)
    if existing_user:
        raise HTTPException(status_code=409, detail="Ce nom d'utilisateur est déjà utilisé.")

    if payload.email:
        existing_email = await db.get_user_by_email(payload.email)
        if existing_email:
            raise HTTPException(status_code=409, detail="Cette adresse email est déjà enregistrée.")

    hashed = auth.hash_password(payload.password)
    user = await db.create_user(username, payload.email, hashed)
    token = auth.create_access_token(user["id"], user["username"], user.get("email"))

    return {
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user.get("email")
        },
        "token": token
    }


@app.post("/api/auth/login", tags=["Auth"])
async def login(payload: LoginRequest):
    identifier = payload.username_or_email.strip()
    user = await db.get_user_by_username(identifier)
    if not user and "@" in identifier:
        user = await db.get_user_by_email(identifier)

    if not user or not auth.verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Identifiants incorrects.")

    token = auth.create_access_token(user["id"], user["username"], user.get("email"))
    return {
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user.get("email")
        },
        "token": token
    }


@app.get("/api/auth/me", tags=["Auth"])
async def get_me(user_token: Dict[str, Any] = Depends(auth.get_current_user)):
    user = await db.get_user_by_id(user_token["sub"])
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")
    return {
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user.get("email")
        }
    }


# ─── Projects (Cloud Sync) Endpoints ──────────────────────────────────────────

class ProjectUpsertRequest(BaseModel):
    id: Optional[str] = None
    title: str
    state: Dict[str, Any]


@app.get("/api/projects", tags=["Projects"])
async def list_projects(user_token: Dict[str, Any] = Depends(auth.get_current_user)):
    """List all projects for authenticated user."""
    projects = await db.list_user_projects(user_token["sub"])
    return projects


@app.get("/api/projects/{project_id}", tags=["Projects"])
async def get_project(project_id: str, user_token: Dict[str, Any] = Depends(auth.get_current_user)):
    """Load full project state from cloud."""
    proj = await db.get_project_with_access(project_id, user_token["sub"])
    if not proj:
        raise HTTPException(status_code=404, detail="Projet introuvable ou accès refusé.")
    return proj


@app.get("/api/projects/shared/{identifier}", tags=["Projects"])
async def get_shared_project(identifier: str, user_token: Optional[Dict[str, Any]] = Depends(auth.get_current_user_optional)):
    """Load shared or public project by ID or share_token (with or without auth)."""
    user_id = user_token["sub"] if user_token else None
    proj = await db.get_project_with_access(identifier, user_id)
    if not proj:
        raise HTTPException(
            status_code=404, 
            detail="Document introuvable ou accès restreint. Demandez un accès au propriétaire ou connectez-vous."
        )
    return proj


class ShareInviteRequest(BaseModel):
    username_or_email: str
    role: str = "viewer"


class PublicAccessRequest(BaseModel):
    is_public: bool
    public_role: str = "viewer"


@app.get("/api/projects/{project_id}/share", tags=["Projects"])
async def get_project_sharing(project_id: str, user_token: Dict[str, Any] = Depends(auth.get_current_user)):
    """Get collaborator list and public access configuration."""
    try:
        details = await db.get_project_sharing_details(project_id, user_token["sub"])
        return details
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching sharing details: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/projects/{project_id}/share", tags=["Projects"])
async def invite_collaborator(project_id: str, payload: ShareInviteRequest, user_token: Dict[str, Any] = Depends(auth.get_current_user)):
    """Add or update collaborator permission."""
    try:
        res = await db.add_or_update_share(user_token["sub"], project_id, payload.username_or_email, payload.role)
        return res
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error sharing project: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/projects/{project_id}/share/{target_user_id}", tags=["Projects"])
async def remove_collaborator(project_id: str, target_user_id: str, user_token: Dict[str, Any] = Depends(auth.get_current_user)):
    """Remove a collaborator from document."""
    try:
        ok = await db.remove_share(user_token["sub"], project_id, target_user_id)
        if not ok:
            raise HTTPException(status_code=404, detail="Collaborateur introuvable.")
        return {"success": True}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Error removing collaborator: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/projects/{project_id}/public-access", tags=["Projects"])
async def set_public_access(project_id: str, payload: PublicAccessRequest, user_token: Dict[str, Any] = Depends(auth.get_current_user)):
    """Configure general public link access."""
    try:
        res = await db.update_public_access(user_token["sub"], project_id, payload.is_public, payload.public_role)
        return res
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating public access: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/projects", tags=["Projects"])
async def save_project(payload: ProjectUpsertRequest, user_token: Dict[str, Any] = Depends(auth.get_current_user)):
    """Save / auto-save project state to cloud."""
    try:
        saved = await db.upsert_project(user_token["sub"], payload.id, payload.title, payload.state)
        return saved
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to save project: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur de sauvegarde: {str(e)}")


@app.delete("/api/projects/{project_id}", tags=["Projects"])
async def delete_project(project_id: str, user_token: Dict[str, Any] = Depends(auth.get_current_user)):
    """Delete a cloud project."""
    ok = await db.delete_project(user_token["sub"], project_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Projet introuvable.")
    return {"success": True}


# ─── Modules Endpoints ────────────────────────────────────────────────────────

@app.get("/modules", response_model=List[ModuleMetadata], tags=["Modules"])
def list_modules():
    return registry.list_all()


@app.get("/modules/{module_id}", response_model=ModuleMetadata, tags=["Modules"])
def get_module(module_id: str):
    meta = registry.get(module_id)
    if not meta:
        raise HTTPException(status_code=404, detail=f"Module '{module_id}' not found.")
    return meta


@app.post("/modules/upload", response_model=ModuleMetadata, tags=["Modules"])
async def upload_module_zip(file: UploadFile = File(...)):
    if not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only .zip module packages are accepted.")

    content = await file.read()
    try:
        meta = registry.register_zip(content)
        return meta
    except SecurityError as e:
        raise HTTPException(status_code=400, detail=f"Security violation: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Invalid module package: {str(e)}")


class ModuleTransformRequest(BaseModel):
    solution_text: str
    segments: Optional[List[Dict[str, Any]]] = None
    options: Optional[Dict[str, Any]] = None


@app.post("/modules/{module_id}/execute", response_model=EncodedOutput, tags=["Modules"])
def execute_module(module_id: str, payload: ModuleTransformRequest):
    return registry.execute(
        module_id=module_id,
        solution_text=payload.solution_text,
        segments=payload.segments,
        options=payload.options
    )


# ─── Diffraction Endpoints ───────────────────────────────────────────────────

class SolveRequest(BaseModel):
    segments: List[ItinerarySegment]
    preset_id: Optional[str] = "seconde_classe_1"
    custom_preset: Optional[PresetConfig] = None
    seed: Optional[int] = None


@app.get("/diffraction/presets", response_model=List[PresetConfig], tags=["Diffraction"])
def list_presets():
    return list(BUILTIN_PRESETS.values())


@app.post("/diffraction/solve", response_model=DiffractionResult, tags=["Diffraction"])
def solve_diffraction(payload: SolveRequest):
    if payload.custom_preset:
        preset = payload.custom_preset
    else:
        preset = BUILTIN_PRESETS.get(payload.preset_id or "seconde_classe_1")
        if not preset:
            raise HTTPException(status_code=400, detail=f"Unknown preset '{payload.preset_id}'.")

    solver = DiffractionSolver(modules={m.id: m for m in registry.list_all()})
    return solver.solve(payload.segments, preset, random_seed=payload.seed)


# ─── Rendering & PDF Endpoints ────────────────────────────────────────────────

class FullCarnetGenerationRequest(BaseModel):
    segments: List[ItinerarySegment]
    preset_id: Optional[str] = "seconde_classe_1"
    options: CarnetRenderOptions
    seed: Optional[int] = None


@app.post("/render/html", response_class=HTMLResponse, tags=["Rendering"])
def render_carnet_html(payload: FullCarnetGenerationRequest):
    preset = BUILTIN_PRESETS.get(payload.preset_id or "seconde_classe_1")
    if not preset:
        raise HTTPException(status_code=400, detail=f"Unknown preset '{payload.preset_id}'.")

    solver = DiffractionSolver(modules={m.id: m for m in registry.list_all()})
    diffraction_res = solver.solve(payload.segments, preset, random_seed=payload.seed)

    render_blocks: List[StepRenderBlock] = []
    for step in diffraction_res.assignments:
        mid = step.module_id
        meta = registry.get(mid)
        plain_nav = f"Prendre azimut {int(step.azimut)}° sur {int(step.distance_m)}m."
        transformed = registry.execute(
            mid,
            solution_text=plain_nav,
            segments=[{"azimut": step.azimut, "distance": step.distance_m}]
        )
        render_blocks.append(StepRenderBlock(
            step_number=step.step_number,
            module_id=mid,
            module_name=meta.name if meta else mid,
            distance_m=int(step.distance_m),
            azimut=int(step.azimut),
            solution_text=plain_nav,
            encoded_text=transformed.encoded_text,
            svg_content=transformed.svg_content,
            render_type=transformed.render_type.value,
            poi_name=step.poi_info,
            annexes=transformed.annexes
        ))

    html = render_service.render_html(render_blocks, payload.options)
    return HTMLResponse(content=html)


@app.post("/render/pdf", tags=["Rendering"])
def render_carnet_pdf(payload: FullCarnetGenerationRequest):
    html_response = render_carnet_html(payload)
    html_content = html_response.body.decode("utf-8")

    temp_pdf = STORAGE_DIR / "temp" / f"carnet_{os.urandom(4).hex()}.pdf"
    render_service.compile_pdf(html_content, temp_pdf)

    filename = f"{payload.options.title.replace(' ', '_')}_{'SOLUCE' if payload.options.is_solution else 'SCOUT'}.pdf"
    return FileResponse(
        path=str(temp_pdf),
        filename=filename,
        media_type="application/pdf"
    )


class RawHtmlPdfRequest(BaseModel):
    html: str
    title: Optional[str] = "carnet"


@app.post("/render/html-to-pdf", tags=["Rendering"])
@app.post("/api/render/html-to-pdf", tags=["Rendering"])
def render_raw_html_to_pdf(payload: RawHtmlPdfRequest):
    temp_pdf = STORAGE_DIR / "temp" / f"raw_pdf_{os.urandom(4).hex()}.pdf"
    render_service.compile_pdf(payload.html, temp_pdf)
    safe_title = (payload.title or 'carnet').replace(' ', '_')
    return FileResponse(
        path=str(temp_pdf),
        filename=f"{safe_title}.pdf",
        media_type="application/pdf"
    )


# ─── Production SPA Static Mount ──────────────────────────────────────────────

DIST_DIR = PROJECT_ROOT / "dist"
if not DIST_DIR.exists():
    DIST_DIR = Path("/app/dist")

if DIST_DIR.exists():
    assets_dir = DIST_DIR / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        if full_path.startswith("api/") or full_path.startswith("health") or full_path.startswith("docs") or full_path.startswith("openapi.json") or full_path.startswith("modules/") or full_path.startswith("diffraction/") or full_path.startswith("render/"):
            raise HTTPException(status_code=404, detail="Not Found")
        target_file = DIST_DIR / full_path
        if target_file.is_file():
            return FileResponse(target_file)
        index_file = DIST_DIR / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        raise HTTPException(status_code=404, detail="SPA index.html not found.")
