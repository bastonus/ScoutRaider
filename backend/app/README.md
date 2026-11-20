# app

## Overview
FastAPI core application setup, dependency injection, and middleware orchestration.

## Interface
- `[auth.py] def hash_password()`
- `[auth.py] def verify_password()`
- `[auth.py] def create_access_token()`
- `[auth.py] def decode_access_token()`
- `[auth.py] def get_current_user_optional()`
- `[auth.py] def get_current_user()`
- `[config.py] class Settings`
- `[config.py] def get_sync_database_url()`
- `[database.py] class Base`
- `[database.py] def get_db()`
- `[database.py] def init_db()`
- `[database.py] def close_db()`
- `[db.py] def init_db()`
- `[db.py] def get_user_by_username()`
- `[db.py] def get_user_by_email()`
- `[db.py] def get_user_by_id()`
- `[db.py] def create_user()`
- `[db.py] def list_user_projects()`
- `[db.py] def get_project_with_access()`
- `[db.py] def upsert_project()`
- `[db.py] def delete_project()`
- `[db.py] def get_project_sharing_details()`
- `[db.py] def add_or_update_share()`
- `[db.py] def remove_share()`
- `[db.py] def update_public_access()`
- *(and 16 more exported symbols)*

### Subdirectories
- [ai](./ai/README.md) - AI copilot integration service facilitating document generation and narrative synthesis.
- [api](./api/README.md) - FastAPI REST API router endpoints handling auth, documents, assets, export, and project sharing.
- [connectors](./connectors/README.md) - External service connectors interfacing with third-party cartography, geocoding, and storage.
- [diffraction](./diffraction/README.md) - Diffraction and obstacle computation algorithms for radio / line-of-sight analysis.
- [mcp](./mcp/README.md) - Model Context Protocol (MCP) server endpoints exposing ScoutRaider backend tools to AI assistants.
- [models](./models/README.md) - SQLAlchemy ORM database models defining relational schema for users, documents, and assets.
- [modules](./modules/README.md) - Raid puzzle and cryptography modules (Morse, Vigenere, Avocat, etc.) on the backend.
- [renderer](./renderer/README.md) - Server-side document and map rendering engine compiling HTML and SVG templates.
- [schemas](./schemas/README.md) - Pydantic request and response schemas defining API data validation contracts.
- [services](./services/README.md) - Business logic services managing authentication, S3 assets, PDF compilation, and project archives.

## Invariants
- [auth.py] Enforces: HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
           
- [db.py] Enforces: ValueError(f"Utilisateur « {target_identifier} » introuvable.")
- [db.py] Enforces: PermissionError("Seul le propriétaire du document peut modifier les partages.")
- [db.py] Enforces: PermissionError("Vous ne pouvez supprimer que vos propres modules.")
- [db.py] Enforces: PermissionError("Seul le propriétaire peut retirer l'accès à un collaborateur.")
- [db.py] Enforces: PermissionError("Ce document est en lecture seule (accès Lecteur)

## Side Effects
- None

## Verification
- Run: `pytest tests/ -v`
