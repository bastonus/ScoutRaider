# app/schemas/document.py - Document schemas
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Optional, Literal
import uuid


class DocumentBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    schema_version: Literal["2.0"] = "2.0"


class DocumentCreate(DocumentBase):
    pass


class DocumentUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    json_data: Optional[dict] = None
    page_layout: Optional[dict] = None
    version: int  # For optimistic locking


class DocumentResponse(DocumentBase):
    id: uuid.UUID
    owner_id: uuid.UUID
    version: int
    created_at: datetime
    updated_at: datetime
    last_synced_at: Optional[datetime] = None
    is_deleted: bool = False

    model_config = ConfigDict(from_attributes=True)


class DocumentListItem(BaseModel):
    id: uuid.UUID
    title: str
    updated_at: datetime
    version: int
    owner_id: uuid.UUID
    is_shared: bool = False

    model_config = ConfigDict(from_attributes=True)


class AssetResponse(BaseModel):
    id: uuid.UUID
    document_id: uuid.UUID
    asset_id: str
    filename: str
    mime_type: str
    size_bytes: int
    width: Optional[int] = None
    height: Optional[int] = None
    asset_type: str
    archive_path: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AssetUploadResponse(BaseModel):
    asset_id: str
    url: str
    mime_type: str
    size: int
    width: Optional[int] = None
    height: Optional[int] = None


class ExportOptions(BaseModel):
    format: Literal["pdf", "srproj", "html"] = "pdf"
    version: Literal["participant", "solution", "both"] = "participant"
    include_annexes: bool = True
    include_map_pagination: bool = False


class ShareLinkCreate(BaseModel):
    permissions: Literal["read", "comment", "edit"] = "read"
    expires_in_days: Optional[int] = Field(None, ge=1, le=365)


class ShareLinkResponse(BaseModel):
    token: str
    url: str
    permissions: str
    expires_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)