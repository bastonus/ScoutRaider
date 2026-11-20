# app/api/projects.py - Routes pour projets et synchronisation cloud (compatibilité frontend)
from fastapi import APIRouter, Depends, HTTPException, Body, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone
import uuid
import secrets
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


def _is_state_empty(state: Any) -> bool:
    """Helper to detect if a project state contains any real content."""
    if not isinstance(state, dict):
        return True
    routes = state.get("routes") or []
    stages = state.get("stages") or []
    poly_steps = state.get("polygonal_steps") or []
    point_ann = state.get("point_annotations") or []
    area_ann = state.get("area_annotations") or []
    draw_ann = state.get("draw_annotations") or []
    text_ann = state.get("text_annotations") or []
    carnet = state.get("carnet_steps") or {}
    itins = state.get("itineraries") or []
    itin_has_content = any(
        (it.get("stages") or it.get("routes") or it.get("polygonal_steps"))
        for it in itins if isinstance(it, dict)
    )
    return not (routes or stages or poly_steps or point_ann or area_ann or draw_ann or text_ann or carnet or itin_has_content)


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
    has_deletes = False
    for doc in documents:
        clean_title = (doc.title or "").strip()
        if (not clean_title or clean_title == "Document sans titre") and _is_state_empty(doc.json_data):
            doc.is_deleted = True
            has_deletes = True
            continue

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

    if has_deletes:
        await db.commit()

    return projects


@router.post("", response_model=Dict[str, Any])
async def save_project(
    payload: Dict[str, Any] = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """Créer ou mettre à jour un projet (CloudAuthService.saveProject)."""
    raw_id = payload.get("id")
    title = (payload.get("title") or "").strip() or "Document sans titre"
    state = payload.get("state") or {}

    # Refuse to auto-create empty ghost projects with default title
    if not raw_id and title == "Document sans titre" and _is_state_empty(state):
        raise HTTPException(
            status_code=400,
            detail="Impossible de créer un document vide sans titre ni contenu."
        )

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
    db: AsyncSession = Depends(get_db),
    authorization: Optional[str] = Header(None)
):
    """Accède à un projet partagé via son token (alias pour /documents/shared/{token})."""
    result = await db.execute(
        select(ShareLink).options(selectinload(ShareLink.document))
        .where(ShareLink.token == identifier, ShareLink.is_revoked == False)
    )
    link = result.scalar_one_or_none()

    document: Optional[Document] = None
    if link:
        # Vérifier expiration
        if link.expires_at and datetime.now(timezone.utc).replace(tzinfo=None) > link.expires_at:
            raise HTTPException(status_code=410, detail="Lien de partage expiré")

        link.access_count += 1
        link.last_accessed_at = datetime.now(timezone.utc).replace(tzinfo=None)
        await db.commit()

        document = link.document
    else:
        # Try finding if identifier is a project UUID
        try:
            doc_uuid = _to_uuid(identifier)
            res_doc = await db.execute(
                select(Document).options(selectinload(Document.share_links))
                .where(Document.id == doc_uuid, Document.is_deleted == False)
            )
            document = res_doc.scalar_one_or_none()
            if document:
                link = next((sl for sl in document.share_links if not sl.is_revoked), None)
        except Exception:
            pass

    if not document:
        raise HTTPException(status_code=404, detail="Lien de partage invalide ou révoqué")

    # Vérifier si l'utilisateur est le propriétaire (via token JWT optionnel)
    is_owner = False
    if authorization and authorization.startswith("Bearer "):
        try:
            from app.services.auth import decode_token
            jwt_token = authorization.split(" ")[1]
            jwt_payload = decode_token(jwt_token)
            if jwt_payload and jwt_payload.type == "access":
                token_uid = uuid.UUID(jwt_payload.sub)
                if token_uid == document.owner_id:
                    is_owner = True
        except Exception:
            pass

    if not link and not is_owner:
        raise HTTPException(status_code=403, detail="Accès non autorisé à ce document")

    effective_role = "owner" if is_owner else (link.permissions if link else "viewer")
    clean_role = "editor" if effective_role in ("editor", "edit") else ("owner" if is_owner else "viewer")

    return {
        "id": str(document.id),
        "title": document.title,
        "state": document.json_data,
        "role": clean_role,
        "is_owner": is_owner,
        "share_token": link.token if link else ""
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
        "public_role": "editor" if (active_link and active_link.permissions in ("editor", "edit")) else "viewer",
        "is_owner": True,
        "owner": {
            "id": str(current_user.id),
            "username": current_user.username
        },
        "collaborators": [],
        "access_requests": []
    }


@router.post("/{project_id}/public-access")
async def update_project_public_access(
    project_id: str,
    payload: Dict[str, Any] = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """Modifier l'accès général (public/limité) et le rôle (viewer/editor)."""
    doc_uuid = _to_uuid(project_id)
    result = await db.execute(
        select(Document).options(selectinload(Document.share_links))
        .where(Document.id == doc_uuid, Document.is_deleted == False)
    )
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=404, detail="Projet introuvable")

    if document.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Seul le propriétaire peut modifier l'accès général.")

    is_public = bool(payload.get("is_public", False))
    raw_role = payload.get("public_role", "viewer")
    public_role = "editor" if raw_role in ("editor", "edit") else "viewer"

    active_link = next((sl for sl in document.share_links if not sl.is_revoked), None)

    if is_public:
        if active_link:
            active_link.permissions = public_role
            share_token = active_link.token
        else:
            share_token = f"doc_{secrets.token_urlsafe(16)}"
            active_link = ShareLink(
                document_id=document.id,
                creator_id=current_user.id,
                token=share_token,
                permissions=public_role,
                is_revoked=False
            )
            db.add(active_link)
    else:
        # Pass to restricted: revoke all active share links
        for sl in document.share_links:
            sl.is_revoked = True
        share_token = ""

    await db.commit()

    return {
        "is_public": is_public,
        "public_role": public_role,
        "share_token": share_token
    }


@router.post("/{project_id}/share")
async def invite_collaborator(
    project_id: str,
    payload: Dict[str, Any] = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """Inviter un collaborateur par nom d'utilisateur ou email."""
    doc_uuid = _to_uuid(project_id)
    result = await db.execute(
        select(Document).where(Document.id == doc_uuid, Document.is_deleted == False)
    )
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=404, detail="Projet introuvable")
    if document.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Seul le propriétaire peut inviter des collaborateurs")

    username_or_email = (payload.get("username_or_email") or "").strip()
    raw_role = payload.get("role", "viewer")
    role = "editor" if raw_role in ("editor", "edit") else "viewer"

    if not username_or_email:
        raise HTTPException(status_code=400, detail="Nom d'utilisateur ou email requis")

    from app.services.auth import get_user_by_username, get_user_by_email
    target_user = await get_user_by_username(db, username_or_email)
    if not target_user:
        target_user = await get_user_by_email(db, username_or_email)

    if not target_user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable")

    if target_user.id == current_user.id:
        raise HTTPException(status_code=400, detail="Vous êtes déjà propriétaire de ce projet")

    token = f"doc_{secrets.token_urlsafe(16)}"
    share_link = ShareLink(
        document_id=document.id,
        creator_id=current_user.id,
        token=token,
        permissions=role,
        is_revoked=False
    )
    db.add(share_link)
    await db.commit()

    return {
        "success": True,
        "username": target_user.username,
        "role": role,
        "collaborator_id": str(target_user.id)
    }


@router.delete("/{project_id}/share/{target_user_id}")
async def remove_collaborator(
    project_id: str,
    target_user_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """Retirer un collaborateur."""
    doc_uuid = _to_uuid(project_id)
    result = await db.execute(
        select(Document).where(Document.id == doc_uuid, Document.is_deleted == False)
    )
    document = result.scalar_one_or_none()
    if not document:
        raise HTTPException(status_code=404, detail="Projet introuvable")
    if document.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Seul le propriétaire peut retirer des collaborateurs")

    return {"success": True}
