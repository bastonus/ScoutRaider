# app/api/share.py - Routes de partage
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid
import secrets

from app.database import get_db
from app.models.document import Document, ShareLink
from app.api.auth import get_current_user_dependency
from app.schemas.document import ShareLinkCreate, ShareLinkResponse
from app.models.user import User
from app.config import settings

router = APIRouter(prefix="/documents", tags=["share"])


@router.post("/{document_id}/share", response_model=ShareLinkResponse)
async def create_share_link(
    document_id: uuid.UUID,
    share_data: ShareLinkCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """Crée un lien de partage pour un document."""
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.is_deleted == False)
    )
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=404, detail="Document non trouvé")

    if document.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Seul le propriétaire peut partager")

    # Générer token unique (doc_xxxxxxxx)
    token = f"doc_{secrets.token_urlsafe(16)}"

    # Calculer expiration
    expires_at = None
    if share_data.expires_in_days:
        from datetime import datetime, timedelta
        expires_at = datetime.utcnow() + timedelta(days=share_data.expires_in_days)

    share_link = ShareLink(
        document_id=document_id,
        creator_id=current_user.id,
        token=token,
        permissions=share_data.permissions,
        expires_at=expires_at
    )
    db.add(share_link)
    await db.commit()
    await db.refresh(share_link)

    public_url = f"{settings.GARAGE_PUBLIC_URL.replace('s3.', '')}/d/{token}"

    return ShareLinkResponse(
        token=share_link.token,
        url=public_url,
        permissions=share_link.permissions,
        expires_at=share_link.expires_at,
        created_at=share_link.created_at
    )


@router.get("/{document_id}/share", response_model=list[ShareLinkResponse])
async def list_share_links(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """Liste les liens de partage d'un document."""
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.is_deleted == False)
    )
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=404, detail="Document non trouvé")

    if document.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Accès refusé")

    result = await db.execute(
        select(ShareLink).where(ShareLink.document_id == document_id).order_by(ShareLink.created_at.desc())
    )
    links = result.scalars().all()

    public_base = settings.GARAGE_PUBLIC_URL.replace('s3.', '')
    return [
        ShareLinkResponse(
            token=link.token,
            url=f"{public_base}/d/{link.token}",
            permissions=link.permissions,
            expires_at=link.expires_at,
            created_at=link.created_at
        )
        for link in links
    ]


@router.delete("/{document_id}/share/{token}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_share_link(
    document_id: uuid.UUID,
    token: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """Révoque un lien de partage."""
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.is_deleted == False)
    )
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=404, detail="Document non trouvé")

    if document.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Accès refusé")

    result = await db.execute(
        select(ShareLink).where(ShareLink.token == token, ShareLink.document_id == document_id)
    )
    link = result.scalar_one_or_none()

    if not link:
        raise HTTPException(status_code=404, detail="Lien de partage non trouvé")

    link.is_revoked = True
    await db.commit()


# Route publique pour accéder via token de partage
@router.get("/shared/{token}")
async def access_shared_document(
    token: str,
    db: AsyncSession = Depends(get_db)
):
    """Accède à un document partagé via son token (sans authentification requise)."""
    result = await db.execute(
        select(ShareLink).where(ShareLink.token == token, ShareLink.is_revoked == False)
    )
    link = result.scalar_one_or_none()

    if not link:
        raise HTTPException(status_code=404, detail="Lien de partage invalide ou révoqué")

    # Vérifier expiration
    if link.expires_at:
        from datetime import datetime
        if datetime.utcnow() > link.expires_at:
            raise HTTPException(status_code=410, detail="Lien de partage expiré")

    # Incrémenter compteur d'accès
    link.access_count += 1
    from datetime import datetime
    link.last_accessed_at = datetime.utcnow()
    await db.commit()

    # Récupérer le document
    result = await db.execute(
        select(Document).options(selectinload(Document.assets))
        .where(Document.id == link.document_id, Document.is_deleted == False)
    )
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=404, detail="Document non trouvé")

    # Retourner selon les permissions
    # Pour read: document complet mais sans infos sensibles
    # Pour edit/comment: marquer comme éditable
    return {
        "document": document,
        "permissions": link.permissions,
        "share_token": token
    }