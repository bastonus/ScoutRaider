# app/api/import_export.py - Import .srproj et migration .srdoc
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid
import json

from app.database import get_db
from app.models.document import Document, Asset
from app.services.archive import archive_service
from app.services.s3_client import garage_client
from app.api.auth import get_current_user_dependency
from app.models.user import User

router = APIRouter(prefix="/documents", tags=["import"])


@router.post("/import", response_model=dict)
async def import_srproj(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """
    Importe un document depuis une archive .srproj.

    L'archive contient:
    - manifest.json (DocumentV2)
    - assets/ (fichiers binaires)
    """
    if not file.filename.endswith(".srproj"):
        raise HTTPException(status_code=400, detail="Format non supporté. Utilisez .srproj")

    content = await file.read()

    # Valider l'archive
    is_valid, error = archive_service.validate_srproj(content)
    if not is_valid:
        raise HTTPException(status_code=400, detail=f"Archive invalide: {error}")

    # Extraire manifest et assets
    try:
        manifest, asset_blobs = archive_service.extract_srproj(content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erreur extraction: {e}")

    # Créer le document en base
    document = Document(
        owner_id=current_user.id,
        title=manifest.get("title", "Document importé"),
        schema_version=manifest.get("schemaVersion", "2.0"),
        json_data=manifest,
        page_layout=manifest.get("pageLayout", {}),
        version=1
    )
    db.add(document)
    await db.flush()

    # Uploader les assets vers Garage et enregistrer en base
    uploaded_assets = 0
    for asset_id, asset_data in asset_blobs.items():
        # Trouver les infos de l'asset dans le manifest
        asset_info = None
        for font in manifest.get("assets", {}).get("fonts", []):
            if font.get("assetId") == asset_id:
                asset_info = {"type": "font", "mime": font.get("mimeType", "font/woff2"), "path": font.get("path")}
                break
        if not asset_info:
            for img_key, img_data in manifest.get("assets", {}).get("images", {}).items():
                if img_data.get("assetId") == asset_id:
                    asset_info = {"type": "image", "mime": img_data.get("mimeType", "image/webp"), "path": img_data.get("path")}
                    break

        if not asset_info:
            continue

        # Upload vers Garage
        try:
            await garage_client.upload_asset(
                asset_id=asset_id,
                data=asset_data,
                mime_type=asset_info["mime"],
                asset_type=asset_info["type"]
            )
        except Exception as e:
            # Log mais continuer
            continue

        # Enregistrer en base
        asset = Asset(
            document_id=document.id,
            asset_id=asset_id,
            filename=asset_info["path"].split("/")[-1],
            mime_type=asset_info["mime"],
            size_bytes=len(asset_data),
            asset_type=asset_info["type"],
            archive_path=asset_info["path"]
        )
        db.add(asset)
        uploaded_assets += 1

    await db.commit()
    await db.refresh(document)

    return {
        "document_id": str(document.id),
        "title": document.title,
        "assets_imported": uploaded_assets,
        "message": "Import réussi"
    }


@router.post("/migrate-srdoc", response_model=dict)
async def migrate_srdoc(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """
    Migre un ancien fichier .srdoc (JSON v5) vers le nouveau format .srproj (v2.0).

    Note: Cette route fait la conversion côté serveur.
    Le frontend peut aussi le faire via documentMigration.ts
    """
    if not file.filename.endswith((".srdoc", ".scoutproj")):
        raise HTTPException(status_code=400, detail="Format non supporté. Utilisez .srdoc ou .scoutproj")

    content = await file.read()
    try:
        old_state = json.loads(content.decode("utf-8"))
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Fichier JSON invalide")

    # La migration réelle nécessite la logique documentMigration.ts
    # Ici on crée un document minimal pour compatibilité
    # TODO: Implémenter la migration complète côté serveur si nécessaire

    document = Document(
        owner_id=current_user.id,
        title=old_state.get("document_title", "Document migré"),
        schema_version="2.0",
        json_data={
            "schemaVersion": "2.0",
            "id": str(uuid.uuid4()),
            "title": old_state.get("document_title", "Document migré"),
            "createdAt": old_state.get("created_at", ""),
            "updatedAt": old_state.get("updated_at", ""),
            "version": 1,
            "assets": {"fonts": [], "images": {}},
            "pageLayout": {
                "format": "A4",
                "orientation": "portrait",
                "margins": {"top": "20mm", "bottom": "20mm", "left": "15mm", "right": "15mm"},
                "header": {"enabled": True, "left": "Troupe 1ère Port-Marly", "right": "{{document.title}}"},
                "footer": {"enabled": True, "center": "Page {{page}} / {{pages}}"}
            },
            "blocks": [],
            "settings": {}
        },
        page_layout={},
        version=1
    )
    db.add(document)
    await db.commit()
    await db.refresh(document)

    return {
        "document_id": str(document.id),
        "title": document.title,
        "message": "Migration basique effectuée. Utilisez l'éditeur pour compléter."
    }