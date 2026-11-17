# app/api/projects.py - Routes pour projets partagés (compatibilité frontend)
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone
from app.database import get_db
from app.models.document import Document, ShareLink

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("/shared/{identifier}")
async def access_shared_project(
    identifier: str,
    db: AsyncSession = Depends(get_db)
):
    """Accède à un projet partagé via son token (alias pour /documents/shared/{token})."""
    result = await db.execute(
        select(ShareLink).where(ShareLink.token == identifier, ShareLink.is_revoked == False)
    )
    link = result.scalar_one_or_none()

    if not link:
        raise HTTPException(status_code=404, detail="Lien de partage invalide ou révoqué")

    # Vérifier expiration
    if link.expires_at:
        if datetime.now(timezone.utc).replace(tzinfo=None) > link.expires_at:
            raise HTTPException(status_code=410, detail="Lien de partage expiré")

    # Incrémenter compteur d'accès
    link.access_count += 1
    link.last_accessed_at = datetime.now(timezone.utc).replace(tzinfo=None)
    await db.commit()

    # Récupérer le document
    result = await db.execute(
        select(Document).options(selectinload(Document.assets))
        .where(Document.id == link.document_id, Document.is_deleted == False)
    )
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=404, detail="Document non trouvé")

    # Retourner format attendu par frontend (CloudAuthService.getSharedProject)
    return {
        "id": str(document.id),
        "title": document.title,
        "state": document.json_data,  # AppState
        "role": link.permissions,  # 'read' | 'comment' | 'edit'
        "is_owner": False,
        "share_token": link.token
    }