# app/api/projects.py - Routes pour projets et synchronisation cloud (compatibilité frontend)
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone
import uuid
from typing import Any, Dict, List, Optional

from app.database import get_db
from app.models.document import Document, ShareLink
from app.models.user import User
from app.api.auth import get_current_user_dependency

router = APIRouter(prefix="/projects", tags=["projects"])


def _to_uuid(val: Any) -> uuid.UUID:
    """Convert string or UUID to uuid.UUID deterministically."""
    if isinstance(val, uuid.UUID):
        return val
    try:
        return uuid.UUID(str(val))
    except (ValueError, TypeError, AttributeError):
        return uuid.uuid5(uuid.NAMESPACE_DNS, str(val))


@router.get("", response_model=List[Dict[str, Any]])
async def list_projects(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """Lister tous les projets de l'utilisateur pour ProjectsHomePage et synchronisation."""
    result = await db.execute(
        select(Document)
        .options(selectinload(Document.share_links))
        .where(Document.owner_id == current_user.id, Document.is_deleted == False)
        .order_by(Document.updated_at.desc())
    )
    documents = result.scalars().all()

    projects = []
    for doc in documents:
        share_token = None
        for sl in doc.share_links:
            if not sl.is_revoked:
                share_token = sl.token
                break

        projects.append({
            "id": str(doc.id),
            "title": doc.title,
            "share_token": share_token,
            "is_public": bool(share_token),
            "public_role": "viewer",
            "owner_id": str(doc.owner_id),
            "owner_username": current_user.username,
            "role": "owner",
            "is_owner": True,
            "created_at": doc.created_at.isoformat() if doc.created_at else "",
            "updated_at": doc.updated_at.isoformat() if doc.updated_at else ""
        })

    return projects


@router.post("", response_model=Dict[str, Any])
async def save_project(
    payload: Dict[str, Any] = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """Créer ou mettre à jour un projet (CloudAuthService.saveProject)."""
    raw_id = payload.get("id")
    title = payload.get("title") or "Document sans titre"
    state = payload.get("state") or {}

    document: Optional[Document] = None
    if raw_id:
        doc_uuid = _to_uuid(raw_id)
        result = await db.execute(
            select(Document)
            .options(selectinload(Document.share_links))
            .where(Document.id == doc_uuid, Document.owner_id == current_user.id, Document.is_deleted == False)
        )
        document = result.scalar_one_or_none()

    if document:
        document.title = title
        document.json_data = state
        document.version += 1
        document.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    else:
        new_id = _to_uuid(raw_id) if raw_id else uuid.uuid4()
        document = Document(
            id=new_id,
            owner_id=current_user.id,
            title=title,
            json_data=state,
            version=1,
            created_at=datetime.now(timezone.utc).replace(tzinfo=None),
            updated_at=datetime.now(timezone.utc).replace(tzinfo=None)
        )
        db.add(document)

    await db.commit()
    await db.refresh(document)

    share_token = None
    for sl in getattr(document, "share_links", []):
        if not sl.is_revoked:
            share_token = sl.token
            break

    return {
        "id": str(document.id),
        "title": document.title,
        "state": document.json_data,
        "share_token": share_token,
        "role": "owner",
        "is_owner": True,
        "created_at": document.created_at.isoformat() if document.created_at else "",
        "updated_at": document.updated_at.isoformat() if document.updated_at else ""
    }


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

    return {
        "id": str(document.id),
        "title": document.title,
        "state": document.json_data,
        "role": link.permissions,
        "is_owner": False,
        "share_token": link.token
    }


@router.get("/{project_id}", response_model=Dict[str, Any])
async def get_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """Récupérer un projet spécifique (CloudAuthService.getProject)."""
    doc_uuid = _to_uuid(project_id)
    result = await db.execute(
        select(Document)
        .options(selectinload(Document.share_links))
        .where(Document.id == doc_uuid, Document.is_deleted == False)
    )
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=404, detail="Projet introuvable")

    is_owner = (document.owner_id == current_user.id)
    if not is_owner:
        # Vérifier si l'utilisateur a un lien de partage
        has_share = any(not sl.is_revoked for sl in document.share_links)
        if not has_share:
            raise HTTPException(status_code=403, detail="Accès non autorisé à ce projet")

    share_token = None
    for sl in document.share_links:
        if not sl.is_revoked:
            share_token = sl.token
            break

    return {
        "id": str(document.id),
        "title": document.title,
        "state": document.json_data,
        "role": "owner" if is_owner else "viewer",
        "is_owner": is_owner,
        "owner_id": str(document.owner_id),
        "share_token": share_token,
        "created_at": document.created_at.isoformat() if document.created_at else "",
        "updated_at": document.updated_at.isoformat() if document.updated_at else ""
    }


@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """Supprimer un projet (soft-delete)."""
    doc_uuid = _to_uuid(project_id)
    result = await db.execute(
        select(Document).where(Document.id == doc_uuid, Document.owner_id == current_user.id, Document.is_deleted == False)
    )
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=404, detail="Projet introuvable")

    document.is_deleted = True
    document.deleted_at = datetime.now(timezone.utc).replace(tzinfo=None)
    await db.commit()

    return {"success": True, "id": str(document.id)}


@router.get("/{project_id}/share")
async def get_project_sharing(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """Détails de partage d'un projet."""
    doc_uuid = _to_uuid(project_id)
    result = await db.execute(
        select(Document).options(selectinload(Document.share_links))
        .where(Document.id == doc_uuid, Document.owner_id == current_user.id, Document.is_deleted == False)
    )
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=404, detail="Projet introuvable")

    active_link = next((sl for sl in document.share_links if not sl.is_revoked), None)

    return {
        "project_id": str(document.id),
        "title": document.title,
        "share_token": active_link.token if active_link else "",
        "is_public": active_link is not None,
        "public_role": active_link.permissions if active_link else "viewer",
        "is_owner": True,
        "owner": {
            "id": str(current_user.id),
            "username": current_user.username
        },
        "collaborators": []
    }
