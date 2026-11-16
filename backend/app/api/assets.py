# app/api/assets.py - Routes upload/download assets
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid

from app.database import get_db
from app.models.document import Document, Asset
from app.services.s3_client import garage_client
from app.services.image_processor import optimize_image, validate_image
from app.api.auth import get_current_user_dependency
from app.schemas.document import AssetUploadResponse, AssetResponse
from app.models.user import User

router = APIRouter(prefix="/assets", tags=["assets"])


MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
ALLOWED_MIME_TYPES = [
    "image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp", "image/tiff",
    "font/woff2", "font/ttf", "font/otf",
    "application/octet-stream"  # Pour les polices parfois détectées ainsi
]


@router.post("", response_model=AssetUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_asset(
    file: UploadFile = File(...),
    document_id: uuid.UUID = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """
    Upload un asset (image, police) vers Garage S3.

    - Images: optimisées en WebP (max 1920px)
    - Polices: stockées telles quelles (.woff2 recommandé)
    """
    # Vérifier le document
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.is_deleted == False)
    )
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=404, detail="Document non trouvé")

    # Vérifier permissions (owner ou partagé en edit)
    if document.owner_id != current_user.id:
        from app.models.document import ShareLink
        share_result = await db.execute(
            select(ShareLink).where(
                ShareLink.document_id == document_id,
                ShareLink.is_revoked == False,
                ShareLink.permissions == "edit"
            )
        )
        if not share_result.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Permission insuffisante pour uploader")

    # Lire le fichier
    content = await file.read()

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail=f"Fichier trop volumineux (max {MAX_FILE_SIZE // 1024 // 1024} MB)")

    mime_type = file.content_type or "application/octet-stream"

    # Déterminer le type d'asset
    asset_type = "font" if mime_type.startswith("font/") or file.filename.endswith((".woff2", ".ttf", ".otf")) else "image"

    # Valider et optimiser si image
    if asset_type == "image":
        if not validate_image(content):
            raise HTTPException(status_code=400, detail="Format d'image non supporté")

        try:
            optimized_content, mime_type, width, height = optimize_image(content, mime_type)
            content = optimized_content
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Erreur traitement image: {e}")
    else:
        # Police : pas d'optimisation
        width = None
        height = None

    # Générer asset_id unique
    asset_id = f"{asset_type}_{uuid.uuid4().hex[:16]}"

    # Upload vers Garage
    try:
        public_url = await garage_client.upload_asset(
            asset_id=asset_id,
            data=content,
            mime_type=mime_type,
            asset_type=asset_type,
            metadata={
                "original_filename": file.filename,
                "document_id": str(document_id),
                "uploaded_by": str(current_user.id)
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Échec upload vers stockage: {e}")

    # Enregistrer en base
    asset = Asset(
        document_id=document_id,
        asset_id=asset_id,
        filename=file.filename,
        mime_type=mime_type,
        size_bytes=len(content),
        width=width,
        height=height,
        asset_type=asset_type,
        archive_path=f"assets/{asset_type}s/{asset_id}.webp" if asset_type == "image" else f"assets/fonts/{asset_id}"
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)

    return AssetUploadResponse(
        assetId=asset_id,
        url=public_url,
        mimeType=mime_type,
        size=len(content),
        width=width,
        height=height
    )


@router.get("/{asset_id}", response_model=AssetResponse)
async def get_asset_info(
    asset_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """Récupère les infos d'un asset."""
    result = await db.execute(
        select(Asset).join(Document).where(
            Asset.asset_id == asset_id,
            Document.is_deleted == False
        )
    )
    asset = result.scalar_one_or_none()

    if not asset:
        raise HTTPException(status_code=404, detail="Asset non trouvé")

    # Vérifier permissions
    if asset.document.owner_id != current_user.id:
        from app.models.document import ShareLink
        share_result = await db.execute(
            select(ShareLink).where(
                ShareLink.document_id == asset.document_id,
                ShareLink.is_revoked == False
            )
        )
        if not share_result.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Accès refusé")

    return asset


@router.get("/{asset_id}/download")
async def download_asset(
    asset_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """Télécharge un asset (streaming depuis Garage)."""
    result = await db.execute(
        select(Asset).join(Document).where(
            Asset.asset_id == asset_id,
            Document.is_deleted == False
        )
    )
    asset = result.scalar_one_or_none()

    if not asset:
        raise HTTPException(status_code=404, detail="Asset non trouvé")

    # Vérifier permissions
    if asset.document.owner_id != current_user.id:
        from app.models.document import ShareLink
        share_result = await db.execute(
            select(ShareLink).where(
                ShareLink.document_id == asset.document_id,
                ShareLink.is_revoked == False
            )
        )
        if not share_result.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Accès refusé")

    try:
        data = await garage_client.download_asset(asset_id, asset.asset_type)
        from fastapi.responses import StreamingResponse
        return StreamingResponse(
            iter([data]),
            media_type=asset.mime_type,
            headers={"Content-Disposition": f'attachment; filename="{asset.filename}"'}
        )
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Asset non trouvé sur le stockage")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur téléchargement: {e}")


@router.get("/{asset_id}/url")
async def get_presigned_url(
    asset_id: str,
    expiry: int = Query(3600, ge=60, le=86400),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """Génère une URL signée pour accès direct temporaire."""
    result = await db.execute(
        select(Asset).join(Document).where(
            Asset.asset_id == asset_id,
            Document.is_deleted == False
        )
    )
    asset = result.scalar_one_or_none()

    if not asset:
        raise HTTPException(status_code=404, detail="Asset non trouvé")

    # Vérifier permissions
    if asset.document.owner_id != current_user.id:
        from app.models.document import ShareLink
        share_result = await db.execute(
            select(ShareLink).where(
                ShareLink.document_id == asset.document_id,
                ShareLink.is_revoked == False
            )
        )
        if not share_result.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Accès refusé")

    try:
        url = await garage_client.generate_presigned_url(asset_id, asset.asset_type, expiry)
        return {"url": url, "expires_in": expiry}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur génération URL: {e}")


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_asset(
    asset_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """Supprime un asset (Garage + DB)."""
    result = await db.execute(
        select(Asset).join(Document).where(
            Asset.asset_id == asset_id,
            Document.is_deleted == False
        )
    )
    asset = result.scalar_one_or_none()

    if not asset:
        raise HTTPException(status_code=404, detail="Asset non trouvé")

    if asset.document.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Seul le propriétaire peut supprimer")

    # Supprimer de Garage
    try:
        await garage_client.delete_asset(asset_id, asset.asset_type)
    except Exception as e:
        # Log mais continuer pour nettoyer la DB
        pass

    # Supprimer de la DB
    await db.delete(asset)
    await db.commit()