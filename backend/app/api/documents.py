# app/api/documents.py - Routes CRUD documents
from fastapi import APIRouter, Depends, HTTPException, status, Query, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import Optional
import uuid

from app.database import get_db
from app.models.document import Document, Asset
from app.schemas.document import (
    DocumentCreate, DocumentUpdate, DocumentResponse, DocumentListItem,
    AssetResponse
)
from app.api.auth import get_current_user_dependency
from app.models.user import User

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def create_document(
    doc_data: DocumentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """Créer un nouveau document."""
    document = Document(
        owner_id=current_user.id,
        title=doc_data.title,
        schema_version=doc_data.schema_version,
        json_data={"schemaVersion": "2.0", "blocks": [], "assets": {"fonts": [], "images": {}}, "pageLayout": {}},
        page_layout={},
        version=1
    )
    db.add(document)
    await db.commit()
    await db.refresh(document)
    return document


@router.get("", response_model=list[DocumentListItem])
async def list_documents(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """Lister les documents de l'utilisateur."""
    query = select(Document).where(
        Document.owner_id == current_user.id,
        Document.is_deleted == False
    ).order_by(Document.updated_at.desc()).limit(limit).offset(offset)

    if search:
        query = query.where(Document.title.ilike(f"%{search}%"))

    result = await db.execute(query)
    documents = result.scalars().all()

    # Compter les partages pour is_shared
    doc_list = []
    for doc in documents:
        # Vérifier s'il y a des liens de partage actifs
        from app.models.document import ShareLink
        share_result = await db.execute(
            select(func.count(ShareLink.id)).where(
                ShareLink.document_id == doc.id,
                ShareLink.is_revoked == False
            )
        )
        share_count = share_result.scalar() or 0

        doc_list.append(DocumentListItem(
            id=doc.id,
            title=doc.title,
            updated_at=doc.updated_at,
            version=doc.version,
            owner_id=doc.owner_id,
            is_shared=share_count > 0
        ))

    return doc_list


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """Récupérer un document complet."""
    result = await db.execute(
        select(Document)
        .options(selectinload(Document.assets))
        .where(Document.id == document_id, Document.is_deleted == False)
    )
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=404, detail="Document non trouvé")

    # Vérifier les permissions (owner ou partagé)
    if document.owner_id != current_user.id:
        # Vérifier partage
        from app.models.document import ShareLink
        share_result = await db.execute(
            select(ShareLink).where(
                ShareLink.document_id == document_id,
                ShareLink.is_revoked == False
            )
        )
        share = share_result.scalar_one_or_none()
        if not share:
            raise HTTPException(status_code=403, detail="Accès refusé")

    return document


@router.put("/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: uuid.UUID,
    doc_update: DocumentUpdate,
    if_match: str = Header(..., alias="If-Match"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """Mettre à jour un document (optimistic locking via If-Match)."""
    expected_version = int(if_match)

    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.is_deleted == False)
    )
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=404, detail="Document non trouvé")

    # Vérifier ownership
    if document.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Seul le propriétaire peut modifier")

    # Vérifier version (optimistic locking)
    if document.version != expected_version:
        raise HTTPException(
            status_code=409,
            detail=f"Conflit de version: document v{document.version}, attendu v{expected_version}",
            headers={"ETag": str(document.version)}
        )

    # Appliquer les mises à jour
    if doc_update.title is not None:
        document.title = doc_update.title
    if doc_update.json_data is not None:
        document.json_data = doc_update.json_data
    if doc_update.page_layout is not None:
        document.page_layout = doc_update.page_layout

    document.version += 1

    await db.commit()
    await db.refresh(document)

    return document


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """Supprimer un document (soft delete)."""
    result = await db.execute(
        select(Document).where(Document.id == document_id, Document.is_deleted == False)
    )
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(status_code=404, detail="Document non trouvé")

    if document.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Seul le propriétaire peut supprimer")

    from datetime import datetime
    document.is_deleted = True
    document.deleted_at = datetime.utcnow()
    await db.commit()


@router.post("/{document_id}/duplicate", response_model=DocumentResponse)
async def duplicate_document(
    document_id: uuid.UUID,
    new_title: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_dependency)
):
    """Dupliquer un document."""
    result = await db.execute(
        select(Document).options(selectinload(Document.assets))
        .where(Document.id == document_id, Document.is_deleted == False)
    )
    source = result.scalar_one_or_none()

    if not source:
        raise HTTPException(status_code=404, detail="Document non trouvé")

    # Vérifier accès (owner ou partagé en edit)
    if source.owner_id != current_user.id:
        from app.models.document import ShareLink
        share_result = await db.execute(
            select(ShareLink).where(
                ShareLink.document_id == document_id,
                ShareLink.is_revoked == False,
                ShareLink.permissions == "edit"
            )
        )
        if not share_result.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="Permission insuffisante")

    # Créer la copie
    new_doc = Document(
        owner_id=current_user.id,
        title=new_title or f"{source.title} (Copie)",
        schema_version=source.schema_version,
        json_data=source.json_data,
        page_layout=source.page_layout,
        version=1
    )
    db.add(new_doc)
    await db.flush()

    # Copier les assets
    for asset in source.assets:
        new_asset = Asset(
            document_id=new_doc.id,
            asset_id=f"{asset.asset_id}_copy_{uuid.uuid4().hex[:8]}",
            filename=asset.filename,
            mime_type=asset.mime_type,
            size_bytes=asset.size_bytes,
            width=asset.width,
            height=asset.height,
            asset_type=asset.asset_type,
            archive_path=asset.archive_path
        )
        db.add(new_asset)

    await db.commit()
    await db.refresh(new_doc)
    return new_doc