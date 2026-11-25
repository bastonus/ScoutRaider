# app

## Overview
FastAPI core application setup, configuration, async database lifecycle, authentication, and REST/MCP API orchestration for the ScoutRaider backend.

## Architecture

### FastAPI Entrypoint (`main.py`)
- **Application**: `app = FastAPI(...)` configured with `settings.APP_NAME` (`"ScoutRaider API"`), `settings.APP_VERSION` (`"0.3.14"`), conditional Swagger/ReDoc docs (`/docs`, `/redoc` enabled only when `settings.DEBUG` is `True`), and `lifespan`.
- **Lifespan (`lifespan`)**: Logs `"starting_up"` and calls `await init_db()` on startup; logs `"shutting_down"` and calls `await close_db()` on shutdown.
- **CORS (`CORSMiddleware`)**: Allows `settings.CORS_ORIGINS` (defaults: `http://localhost:5173`, `tauri://localhost`, `https://scoutraider.app`, `https://scoutraider.silverhorse.fr`, `http://scoutraider.silverhorse.fr`) with `allow_credentials=True`, `allow_methods=["*"]`, and `allow_headers=["*"]`.
- **Structured Logging (`structlog`)**: Configured with stdlib level filtering, ISO timestamps, exception formatting, and `JSONRenderer()`. The HTTP middleware `log_requests` emits `"http_request"` events (`method`, `path`, `status_code`, `duration_ms`). `global_exception_handler` re-raises `HTTPException`, logs `"unhandled_exception"`, and returns HTTP `500` (`{"detail": "Erreur interne du serveur"}`).
- **Health & Mounted Routers**:
  - Direct route `GET /health` (`health_check()`) returns `{"status": "healthy", "version": settings.APP_VERSION, "service": "scoutraider-api"}`.
  - Mounts `health_router` directly (exposing `/health/`, `/health/db`, `/health/s3`, `/health/full`).
  - Mounts all other routers under `settings.API_PREFIX` (`/api`).

### Active Database & Authentication
- **Active Database (`database.py`)**: Uses SQLAlchemy 2.0 async (`create_async_engine`, `async_sessionmaker`, `AsyncSession`, `DeclarativeBase`). Uses `NullPool` when `settings.DEBUG` is `True`, `pool_pre_ping=True`, and `pool_recycle=3600`. Exports `Base`, `engine`, `AsyncSessionLocal`, `get_db()`, `init_db()`, and `close_db()`.
- **Active Authentication (`services/auth.py` + `api/auth.py`)**:
  - `services/auth.py`: Direct `bcrypt` hashing (`BCRYPT_ROUNDS = 12`, `BCRYPT_MAX_PASSWORD_BYTES = 72`), JWT access/refresh tokens via `python-jose` (`HS256`), and async SQLAlchemy `User` queries/updates.
  - `api/auth.py`: Exposes `/api/auth/*` endpoints and FastAPI auth dependencies `get_current_user_dependency` and `get_current_user_optional`.
- **Legacy / Unused Modules (`app/auth.py`, `app/db.py`)**:
  - `app/auth.py` and `app/db.py` are **legacy/unused** modules and are not imported by `main.py`, any active API router, or the test suite. Do not wire new code to them; use `app/database.py` and `app/services/auth.py` + `app/api/auth.py` instead.

### Active API Routers (`api/*.py`)
All routers are re-exported from `api/__init__.py` and mounted in `main.py`:

| Router | File | Prefix | Purpose |
| :--- | :--- | :--- | :--- |
| `auth_router` | `api/auth.py` | `/api/auth` | User registration, login (username or email, sets `refresh_token` HttpOnly cookie), token refresh, logout, `/me` profile, `/debug/test-db` |
| `documents_router` | `api/documents.py` | `/api/documents` | Document CRUD and duplication |
| `assets_router` | `api/assets.py` | `/api/assets` | Garage S3 asset upload (WebP image optimization, fonts, 50 MB max), metadata, download, presigned URLs, deletion |
| `export_router` | `api/export.py` | `/api/documents` | PDF generation via WeasyPrint (`POST /{document_id}/export/pdf`), `.srproj` archive export, raid-pack export |
| `share_router` | `api/share.py` | `/api/documents` | Document share link creation, listing, revocation, and public token access (`/shared/{token}`) |
| `import_export_router` | `api/import_export.py` | `/api/documents` | `.srproj` archive import (`/import`) and `.srdoc` migration (`/migrate-srdoc`) |
| `health_router` | `api/health.py` | `/health` | Service, PostgreSQL (`/health/db`), Garage S3 (`/health/s3`), and combined (`/health/full`) health checks |
| `projects_router` | `api/projects.py` | `/api/projects` | Frontend-compatible project cloud sync CRUD, shared project resolution (`/shared/{identifier}`), public access, and collaborator sharing |
| `hub_router` | `api/hub.py` | `/api/hub` | Hub v2 catalog discovery (`/catalog`, `/catalog/s3`), resource metadata, manifest validation, dependency resolution, custom maps, templates, and S3 module publishing |
| `ai_router` | `api/ai.py` | `/api/ai` | AI Copilot endpoints: `/narrative`, `/riddle`, `/safety-audit`, `/status` |
| `connectors_router` | `api/connectors.py` | `/api/connectors` | External connector listing, connectivity tests, queries, `/search-pois`, `/weather-risk` |
| `mcp_router` | `api/mcp.py` | `/api/mcp` | JSON-RPC 2.0 Model Context Protocol endpoint (`POST /api/mcp`) and schema discovery (`GET /api/mcp/schema`) |

## Interface
- `[main.py] app` (`FastAPI` instance)
- `[main.py] async def lifespan(app: FastAPI)`
- `[main.py] async def log_requests(request: Request, call_next)`
- `[main.py] async def health_check()`
- `[main.py] async def global_exception_handler(request: Request, exc: Exception)`
- `[config.py] class Settings(BaseSettings)` / `settings`
- `[config.py] def get_sync_database_url() -> str`
- `[database.py] engine`, `AsyncSessionLocal`, `class Base(DeclarativeBase)`
- `[database.py] async def get_db() -> AsyncSession`
- `[database.py] async def init_db() -> None`
- `[database.py] async def close_db() -> None`
- `[services/auth.py]` — active auth logic (`verify_password`, `get_password_hash`, `create_access_token`, `create_refresh_token`, `decode_token`, `get_user_by_email`, `get_user_by_username`, `get_user_by_id`, `authenticate_user`, `create_user`, `update_last_login`)
- `[api/auth.py]` — `router`, `get_current_user_dependency`, `get_current_user_optional`
- `[auth.py]`, `[db.py]` — legacy/unused modules (retained on disk only; not wired into the active application)

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
- `[config.py]` `Settings.SECRET_KEY` enforces `min_length=32`.
- `[main.py]` `global_exception_handler` re-raises `HTTPException` so FastAPI's HTTP error responses are preserved while unhandled exceptions return HTTP `500`.
- `[api/auth.py]` Protected routes using `get_current_user_dependency` require a valid `Bearer` access token and an active `User` row in PostgreSQL/SQLAlchemy (`HTTP 401` otherwise).

## Side Effects
- Startup (`lifespan` -> `init_db()`) runs `Base.metadata.create_all` against `settings.DATABASE_URL`; shutdown disposes the async SQLAlchemy engine (`close_db()`).
- Request middleware emits structured JSON logs to stdout via `structlog`.

## Verification
Run from `backend/`:
- Test suite (uses in-memory `sqlite+aiosqlite:///:memory:` via `app/tests/conftest.py`):
  ```bash
  pytest app/tests/ -v
  ```
- Local API server:
  ```bash
  uvicorn app.main:app --reload --port 8000
  ```
