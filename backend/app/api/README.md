# api

## Overview
FastAPI REST API router endpoints handling auth, documents, assets, export, and project sharing.

## Interface
- `[assets.py] def upload_asset()`
- `[assets.py] def get_asset_info()`
- `[assets.py] def download_asset()`
- `[assets.py] def get_presigned_url()`
- `[assets.py] def delete_asset()`
- `[auth.py] def get_current_user_dependency()`
- `[auth.py] def register()`
- `[auth.py] def debug_test_db()`
- `[auth.py] def login()`
- `[auth.py] def refresh_token()`
- `[auth.py] def logout()`
- `[auth.py] def get_current_user()`
- `[documents.py] def create_document()`
- `[documents.py] def list_documents()`
- `[documents.py] def get_document()`
- `[documents.py] def update_document()`
- `[documents.py] def delete_document()`
- `[documents.py] def duplicate_document()`
- `[export.py] def export_pdf()`
- `[export.py] def export_srproj()`
- `[export.py] def lat_lng_to_world_pixel()`
- `[export.py] def generate_static_map_svg()`
- `[export.py] def get_asset_image_data_uri()`
- `[export.py] def build_export_html()`
- `[export.py] def build_export_css()`
- `[hub.py] def list_catalog()`
- `[hub.py] def get_resource_detail()`
- `[hub.py] def validate_manifest()`
- `[hub.py] def resolve_dependencies()`
- `[hub.py] def register_custom_map()`
- `[hub.py] def generate_template()`
- *(and 14 more exported symbols)*

## Invariants
- [assets.py] Enforces: HTTPException(status_code=400, detail="Format d'image non supporté")
- [assets.py] Enforces: HTTPException(status_code=400, detail=f"Erreur traitement image: {e}")
- [assets.py] Enforces: HTTPException(status_code=500, detail=f"Échec upload vers stockage: {e}")
- [assets.py] Enforces: HTTPException(status_code=413, detail=f"Fichier trop volumineux (max {MAX_FILE_S
- [assets.py] Enforces: HTTPException(status_code=500, detail=f"Erreur génération URL: {e}")
- [auth.py] Enforces: HTTPException(status_code=400, detail="Nom d'utilisateur déjà pris")
- [auth.py] Enforces: HTTPException(status_code=500, detail=f"Registration failed: {type(e)
- [auth.py] Enforces: HTTPException(status_code=401, detail="Refresh token manquant")

## Side Effects
- Database state mutations (commit/execute)

## Verification
- Run: `pytest tests/ -v`
