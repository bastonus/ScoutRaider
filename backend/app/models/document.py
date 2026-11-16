# app/models/document.py - Document, Asset, and ShareLink models
from sqlalchemy import String, Text, Integer, DateTime, ForeignKey, Index, Boolean, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from datetime import datetime
import uuid

from app.database import Base


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False, default="Document sans titre")
    schema_version: Mapped[str] = mapped_column(String(10), nullable=False, default="2.0")

    # JSONB pour le document complet v2.0
    json_data: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    page_layout: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    # Versioning optimiste
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False
    )
    last_synced_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    # Soft delete
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, index=True)
    deleted_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    # Relationships
    owner: Mapped["User"] = relationship("User", back_populates="documents", lazy="selectin")
    assets: Mapped[list["Asset"]] = relationship("Asset", back_populates="document", lazy="selectin", cascade="all, delete-orphan")
    share_links: Mapped[list["ShareLink"]] = relationship("ShareLink", back_populates="document", lazy="selectin", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_documents_owner_updated", "owner_id", "updated_at"),
        Index("ix_documents_active", "is_deleted", "updated_at"),
    )

    def __repr__(self) -> str:
        return f"<Document(id={self.id}, title={self.title}, version={self.version})>"


class Asset(Base):
    __tablename__ = "assets"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    asset_id: Mapped[str] = mapped_column(String(128), unique=True, index=True, nullable=False)  # Clé S3
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    width: Mapped[int] = mapped_column(Integer, nullable=True)
    height: Mapped[int] = mapped_column(Integer, nullable=True)
    # Type d'asset: 'font' | 'image' | 'map'
    asset_type: Mapped[str] = mapped_column(String(20), nullable=False, default="image")
    # Chemin dans l'archive .srproj
    archive_path: Mapped[str] = mapped_column(String(512), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    document: Mapped["Document"] = relationship("Document", back_populates="assets", lazy="selectin")

    __table_args__ = (
        Index("ix_assets_document_type", "document_id", "asset_type"),
    )

    def __repr__(self) -> str:
        return f"<Asset(id={self.id}, asset_id={self.asset_id}, type={self.asset_type})>"


class ShareLink(Base):
    __tablename__ = "share_links"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    creator_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)  # doc_xxx
    permissions: Mapped[str] = mapped_column(String(20), nullable=False, default="read")  # read | comment | edit
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    access_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_accessed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    document: Mapped["Document"] = relationship("Document", back_populates="share_links", lazy="selectin")
    creator: Mapped["User"] = relationship("User", back_populates="share_links", lazy="selectin")

    def __repr__(self) -> str:
        return f"<ShareLink(token={self.token}, permissions={self.permissions})>"