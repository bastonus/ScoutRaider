# app/api/__init__.py
from app.api.auth import router as auth_router
from app.api.documents import router as documents_router
from app.api.assets import router as assets_router
from app.api.export import router as export_router
from app.api.share import router as share_router
from app.api.import_export import router as import_export_router

__all__ = [
    "auth_router",
    "documents_router",
    "assets_router",
    "export_router",
    "share_router",
    "import_export_router",
]