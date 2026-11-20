"""
app/api/hub.py — ScoutRaider Unified Hub REST API.
Exposes endpoints for catalog discovery, manifest validation, dependency resolution,
custom map registration, and AI-first template generation.
"""

from fastapi import APIRouter, HTTPException, Query, Body, Depends
from typing import List, Optional, Dict, Any
from pathlib import Path
import io
import json
import zipfile
import hashlib

from app.modules.schema import (
    HubResourceType,
    DataCapability,
    HubResourceMetadata,
    CustomMapConfig,
    TrameDependencies,
    S3DistributionMeta
)
from app.modules.registry import ModuleRegistry
from app.services.s3_client import garage_client
from app.config import settings

router = APIRouter(prefix="/hub", tags=["hub"])

# Shared registry instance (loads legacy and stored modules)
_SHARED_REGISTRY: Optional[ModuleRegistry] = None


def get_hub_registry() -> ModuleRegistry:
    global _SHARED_REGISTRY
    if _SHARED_REGISTRY is None:
        _SHARED_REGISTRY = ModuleRegistry()
        legacy_dir = Path(__file__).resolve().parents[3] / "legacy" / "modules"
        if legacy_dir.exists():
            _SHARED_REGISTRY.load_from_base_dir(legacy_dir)
    return _SHARED_REGISTRY


# ─── 1. Catalog Search & Query ───────────────────────────────────────────────

@router.get("/catalog")
async def list_catalog(
    resource_type: Optional[str] = Query(None, description="Filtrer par resource_type"),
    capability: Optional[str] = Query(None, description="Filtrer par data_capability"),
    query: Optional[str] = Query(None, description="Recherche textuelle"),
    target_level: Optional[str] = Query(None, description="Filtrer par niveau scout"),
    registry: ModuleRegistry = Depends(get_hub_registry)
) -> Dict[str, Any]:
    """
    Explore le catalogue unifié du Hub ScoutRaider.
    Supporte les filtres par type de ressource, capacité de données (spatial, altimétrie, etc.) et recherche.
    """
    all_modules = registry.list_all()
    results = []

    for m in all_modules:
        # Filter capability
        if capability and capability != "all":
            if not m.data_capability or m.data_capability.value != capability.lower():
                continue

        # Filter query
        if query:
            q = query.lower()
            if q not in m.name.lower() and q not in m.description.lower() and q not in m.id.lower():
                continue

        # Build synthetic Hub item
        cap_str = m.data_capability.value if m.data_capability else "alphabetic"
        results.append({
            "id": m.id,
            "name": m.name,
            "version": m.version,
            "resource_type": HubResourceType.CRYPTO_MODULE.value,
            "data_capability": cap_str,
            "category": m.category.value if hasattr(m.category, "value") else str(m.category),
            "render_type": m.render_type.value if hasattr(m.render_type, "value") else str(m.render_type),
            "description": m.description,
            "author": m.author,
            "is_installed": True,
            "s3_download_url": garage_client.get_module_url(m.id, m.version)
        })

    # Add virtual/default Trames & Maps to catalog for unified visibility
    catalog_items = list(results)

    # Builtin Trames
    if not resource_type or resource_type in ("all", HubResourceType.RAID_TRAME.value):
        catalog_items.extend([
            {
                "id": "trame_exploration_promesse",
                "name": "Trame Exploration & Promesse",
                "version": "2.0.0",
                "resource_type": HubResourceType.RAID_TRAME.value,
                "data_capability": None,
                "description": "Itinéraire d'initiation (10-15 km) pour louveteaux et néo-éclaireurs avec croquis simple et messages clairs.",
                "author": "ScoutRaider Core Team",
                "target_level": "louveteaux",
                "required_modules": ["texte_clair", "carte_simple"],
                "is_installed": True
            },
            {
                "id": "trame_seconde_classe",
                "name": "Trame Raid de Seconde Classe",
                "version": "2.0.0",
                "resource_type": HubResourceType.RAID_TRAME.value,
                "data_capability": None,
                "description": "Épreuve de 24h en binôme (25 km) avec croquis panoramique, relevé topographique et Morse.",
                "author": "ScoutRaider Core Team",
                "target_level": "seconde_classe",
                "required_modules": ["morse", "carte_ign", "texte_clair"],
                "is_installed": True
            },
            {
                "id": "trame_premiere_classe",
                "name": "Trame Raid de Première Classe",
                "version": "2.0.0",
                "resource_type": HubResourceType.RAID_TRAME.value,
                "data_capability": None,
                "description": "Épreuve reine d'autonomie (35 km) exigeant un relevé d'azimuts Gilwell, un chiffre Templier et un désert spirituel.",
                "author": "ScoutRaider Core Team",
                "target_level": "premiere_classe",
                "required_modules": ["gilwell", "templier", "morse", "carte_ign"],
                "is_installed": True
            }
        ])

    return {
        "total": len(catalog_items),
        "resources": catalog_items
    }


# ─── 2. Resource Detail ──────────────────────────────────────────────────────

@router.get("/resources/{resource_id}")
async def get_resource_detail(
    resource_id: str,
    registry: ModuleRegistry = Depends(get_hub_registry)
) -> Dict[str, Any]:
    """
    Récupère le manifeste complet et les métadonnées d'une ressource du Hub.
    """
    meta = registry.get(resource_id)
    if not meta:
        raise HTTPException(status_code=404, detail=f"Ressource '{resource_id}' introuvable dans le Hub.")

    return {
        "manifest": meta.model_dump(),
        "s3_distribution": {
            "s3_key": f"modules/{meta.id}-{meta.version}.zip",
            "checksum_sha256": "calculated_on_publish",
            "download_url": garage_client.get_module_url(meta.id, meta.version)
        }
    }


# ─── 3. Manifest Validation (Agent & Creator Tool) ───────────────────────────

@router.post("/validate")
async def validate_manifest(
    manifest_data: Dict[str, Any] = Body(...)
) -> Dict[str, Any]:
    """
    Valide un manifeste JSON selon les règles du Standard Hub v2.0.
    Utilisable par les agents IA pour l'auto-correction avant publication.
    """
    diagnostic = ModuleRegistry.validate_manifest_payload(manifest_data)
    return diagnostic


# ─── 4. Dependencies Resolution for Trames ───────────────────────────────────

@router.post("/resolve-dependencies")
async def resolve_dependencies(
    payload: Dict[str, Any] = Body(...),
    registry: ModuleRegistry = Depends(get_hub_registry)
) -> Dict[str, Any]:
    """
    Résout le graphe de dépendances d'une Trame de Raid.
    Indique les modules installés, manquants ou téléchargeables depuis S3.
    """
    trame_id = payload.get("trame_id", "custom_trame")
    raw_deps = payload.get("dependencies", {})

    parsed_deps = None
    if raw_deps:
        try:
            parsed_deps = TrameDependencies(**raw_deps)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Format de dépendances invalide: {e}")

    result = registry.resolve_trame_dependencies(trame_id, parsed_deps)
    return result


# ─── 5. Custom Map Registration & Validation ─────────────────────────────────

@router.post("/maps/custom")
async def register_custom_map(
    map_config: CustomMapConfig = Body(...)
) -> Dict[str, Any]:
    """
    Valide et enregistre une source cartographique personnalisée (XYZ, WMTS, etc.).
    """
    # Validation du modèle d'URL
    url = map_config.tile_url
    if map_config.tile_type.value in ("xyz", "tms"):
        if "{z}" not in url or "{x}" not in url or "{y}" not in url:
            raise HTTPException(
                status_code=400,
                detail="L'URL de tuiles XYZ/TMS doit contenir les jokers '{z}', '{x}' et '{y}'."
            )

    return {
        "status": "valid",
        "map_config": map_config.model_dump(),
        "attribution": map_config.attribution or "Carte Personnalisée"
    }


# ─── 6. Agent-First Code Template Generator ──────────────────────────────────

@router.post("/generate-template")
async def generate_template(
    payload: Dict[str, Any] = Body(...)
) -> Dict[str, Any]:
    """
    Génère un squelette complet de module conforme v2.0 pour les agents IA.
    """
    mod_id = payload.get("module_id", "nouveau_module").lower().strip()
    name = payload.get("name", mod_id.replace("_", " ").title())
    res_type = payload.get("resource_type", "crypto_module")
    capability = payload.get("data_capability", "alphabetic")

    sample_manifest = {
        "$schema": "https://scoutraider.org/schemas/v2/module.schema.json",
        "schema_version": "2.0",
        "id": mod_id,
        "name": name,
        "version": "1.0.0",
        "resource_type": res_type,
        "author": "Agent IA ScoutRaider",
        "description": f"Module {name} généré automatiquement pour le Hub ScoutRaider.",
        "data_capability": capability,
        "render_type": "text" if capability in ("alphabetic", "numeric", "alphanumeric") else "svg",
        "entrypoint": "logic/index.ts",
        "constraints": {
            "min_distance_m": 0.0,
            "max_distance_m": None,
            "max_proportion": 0.30,
            "allow_consecutive": False
        }
    }

    sample_ts = f"""/**
 * {name} — Module Logic
 * Capacité: {capability}
 */

export function transform(plainText: string): {{ encoded_text: string }} {{
    // Implémentation de l'algorithme pur
    return {{
        encoded_text: `[{mod_id.upper()}] ${{plainText}}`
    }};
}}
"""

    return {
        "module_id": mod_id,
        "files": {
            "manifest.json": sample_manifest,
            "logic/index.ts": sample_ts,
            "README.md": f"# {name}\n\nModule conforme au Standard ScoutRaider Hub v2.0."
        }
    }


# ─── 7. Module Registration & Direct S3 Storage Publication ──────────────────

@router.post("/publish")
async def publish_module_to_s3(
    payload: Dict[str, Any] = Body(...),
    registry: ModuleRegistry = Depends(get_hub_registry)
) -> Dict[str, Any]:
    """
    Enregistre et publie un module directement dans le bucket S3 Garage (scoutraider-assets/modules/).
    Prend en entrée le manifeste v2 et d'éventuels fichiers sources (logic/index.ts, README.md, assets).
    Valide les règles de sécurité, archive au format ZIP conforme, calcule le SHA-256 et publie sur S3.
    """
    manifest_data = payload.get("manifest")
    if not manifest_data or not isinstance(manifest_data, dict):
        raise HTTPException(status_code=400, detail="Champ 'manifest' obligatoire et valide.")

    # Validation du manifeste selon Hub v2
    try:
        validated_meta = HubResourceMetadata.model_validate(manifest_data)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Manifeste invalide: {e}")

    mod_id = validated_meta.id
    mod_version = validated_meta.version
    zip_filename = f"{mod_id}-{mod_version}.zip"

    # Construction de l'archive ZIP en mémoire
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        # 1. Écrire le manifest.json
        zf.writestr("manifest.json", validated_meta.model_dump_json(indent=2))

        # 2. Écrire les fichiers additionnels fournis ou par défaut
        files = payload.get("files") or {}
        if not files:
            # Squelette par défaut
            default_ts = f"/**\n * {validated_meta.name} v{mod_version}\n */\nexport function transform(text: string) {{ return {{ encoded_text: text }}; }}\n"
            zf.writestr(validated_meta.entrypoint or "logic/index.ts", default_ts)
            zf.writestr("README.md", f"# {validated_meta.name}\n\n{validated_meta.description}")
        else:
            for file_path, file_content in files.items():
                if isinstance(file_content, str):
                    zf.writestr(file_path, file_content)
                elif isinstance(file_content, bytes):
                    zf.writestr(file_path, file_content)

    zip_bytes = zip_buffer.getvalue()

    # Calcul SHA-256 et taille
    sha256 = hashlib.sha256(zip_bytes).hexdigest()
    byte_size = len(zip_bytes)

    # Upload direct sur Garage S3
    try:
        s3_url = await garage_client.upload_module_package(
            module_id=mod_id,
            version=mod_version,
            data=zip_bytes,
            metadata={
                "module_id": mod_id,
                "version": mod_version,
                "sha256": sha256,
                "author": validated_meta.author
            }
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Échec de l'upload vers Garage S3: {e}")

    return {
        "status": "success",
        "action": "registered_and_stored_in_s3",
        "module_id": mod_id,
        "version": mod_version,
        "bucket": garage_client.bucket,
        "s3_key": f"modules/{zip_filename}",
        "s3_url": s3_url,
        "sha256": sha256,
        "byte_size": byte_size,
        "distribution": {
            "archive_url": s3_url,
            "sha256": sha256,
            "byte_size": byte_size,
            "signature": f"sig_sha256_{sha256[:16]}"
        }
    }


@router.get("/catalog/s3")
async def get_s3_catalog_index() -> Dict[str, Any]:
    """
    Récupère l'index global catalog_v2.json hébergé sur le bucket Garage S3.
    """
    try:
        data = await garage_client.download_asset("catalog_v2.json", asset_type="catalog")
        return json.loads(data.decode("utf-8"))
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Index catalog_v2.json introuvable sur Garage S3.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur lors de la lecture du catalogue S3: {e}")

