# app/schemas/__init__.py
from app.schemas.auth import Token, TokenPayload, UserCreate, UserLogin, UserResponse
from app.schemas.document import (
    DocumentCreate, DocumentUpdate, DocumentResponse, DocumentListItem,
    AssetResponse, AssetUploadResponse, ExportOptions, ShareLinkCreate, ShareLinkResponse
)
from app.schemas.asset import AssetUploadResponse as AssetUploadSchema

__all__ = [
    "Token", "TokenPayload", "UserCreate", "UserLogin", "UserResponse",
    "DocumentCreate", "DocumentUpdate", "DocumentResponse", "DocumentListItem",
    "AssetResponse", "AssetUploadResponse", "ExportOptions", "ShareLinkCreate", "ShareLinkResponse",
    "AssetUploadSchema",
]