"""
db.py — Database management for ScoutRaider Suite (PostgreSQL with SQLite fallback)
Handles user accounts, projects, sharing permissions (Owner, Editor, Viewer), and unique permalinks.
"""

import os
import json
import uuid
import logging
import asyncio
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any

logger = logging.getLogger("scoutraider.db")

DEFAULT_PG_URL = "postgres://postgres:MOED1tbZpPwzb1llUs74g8hVY62T8WiAyeroiOJxl5QVcL8sTM4cvZbRAZpC7Lm7@dqitb10gzxtpiejn4kj3ub9b:5432/postgres"
DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_PG_URL)

# SQLite persistent path — /data is a Docker volume mounted by Coolify
# Falls back to local storage if /data is not available
_data_dir = "/data" if os.path.isdir("/data") else os.path.join(os.path.dirname(__file__), "storage")
_sqlite_path = os.path.join(_data_dir, "scoutraider.db")

_pg_pool = None
_use_sqlite = False
_sqlite_conn = None
_pg_error = None


async def init_db():
    """Initialize DB connection and run migrations."""
    global _pg_pool, _use_sqlite, _pg_error

    # Force SQLite mode via env var — useful when PostgreSQL has no persistent volume
    if os.getenv("USE_SQLITE", "").lower() in ("1", "true", "yes"):
        logger.info(f"USE_SQLITE=true — using SQLite at {_sqlite_path}")
        _use_sqlite = True
        _init_sqlite()
        return

    pg_url = DATABASE_URL
    logger.info("Attempting connection to PostgreSQL database...")

    # Retry connection up to 4 times (total ~15s) in case internal DNS or PG container is warming up
    max_attempts = 4
    for attempt in range(1, max_attempts + 1):
        try:
            import asyncpg
            _pg_pool = await asyncio.wait_for(
                asyncpg.create_pool(
                    dsn=pg_url,
                    min_size=1,
                    max_size=10,
                    command_timeout=60
                ),
                timeout=6.0
            )
            logger.info("Successfully connected to PostgreSQL database.")
            _use_sqlite = False
            _pg_error = None
            break
        except Exception as e:
            _pg_error = str(e)
            logger.warning(f"PostgreSQL connection attempt {attempt}/{max_attempts} failed: {e}")
            if attempt < max_attempts:
                await asyncio.sleep(attempt * 1.5)
            else:
                logger.error(f"All PostgreSQL connection attempts failed ({_pg_error}). Falling back to local SQLite.")
                _use_sqlite = True
                _init_sqlite()
                return

    try:
        # Create tables and run schema migrations in PostgreSQL
        async with _pg_pool.acquire() as conn:
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    username VARCHAR(100) UNIQUE NOT NULL,
                    email VARCHAR(255) UNIQUE,
                    password_hash VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS projects (
                    id VARCHAR(64) PRIMARY KEY,
                    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    title VARCHAR(255) NOT NULL,
                    state JSONB NOT NULL,
                    share_token VARCHAR(64) UNIQUE,
                    is_public BOOLEAN DEFAULT FALSE,
                    public_role VARCHAR(20) DEFAULT 'viewer',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS project_shares (
                    id TEXT PRIMARY KEY,
                    project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    role VARCHAR(20) NOT NULL DEFAULT 'viewer',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(project_id, user_id)
                );

                CREATE TABLE IF NOT EXISTS marketplace_modules (
                    id VARCHAR(64) PRIMARY KEY,
                    name VARCHAR(128) NOT NULL,
                    category VARCHAR(50) NOT NULL DEFAULT 'code',
                    description TEXT,
                    author_id TEXT,
                    author_username VARCHAR(100),
                    version VARCHAR(30) DEFAULT '1.0.0',
                    is_public BOOLEAN DEFAULT TRUE,
                    code TEXT,
                    config JSONB DEFAULT '{}'::jsonb,
                    preview_image TEXT,
                    likes_count INTEGER DEFAULT 0,
                    forked_from_id VARCHAR(64),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );

                CREATE TABLE IF NOT EXISTS user_library (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    module_id VARCHAR(64) NOT NULL,
                    custom_name VARCHAR(128),
                    category VARCHAR(50) DEFAULT 'code',
                    synced_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    local_overrides JSONB DEFAULT '{}'::jsonb,
                    UNIQUE(user_id, module_id)
                );

                -- Migrations for existing tables if needed
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='share_token') THEN
                        ALTER TABLE projects ADD COLUMN share_token VARCHAR(64) UNIQUE;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='is_public') THEN
                        ALTER TABLE projects ADD COLUMN is_public BOOLEAN DEFAULT FALSE;
                    END IF;
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='projects' AND column_name='public_role') THEN
                        ALTER TABLE projects ADD COLUMN public_role VARCHAR(20) DEFAULT 'viewer';
                    END IF;
                END $$;

                CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
                CREATE INDEX IF NOT EXISTS idx_projects_share_token ON projects(share_token);
                CREATE INDEX IF NOT EXISTS idx_project_shares_user ON project_shares(user_id);
                CREATE INDEX IF NOT EXISTS idx_marketplace_category ON marketplace_modules(category);
                CREATE INDEX IF NOT EXISTS idx_marketplace_public ON marketplace_modules(is_public);
                CREATE INDEX IF NOT EXISTS idx_user_library_user ON user_library(user_id);
            """)
        logger.info("PostgreSQL tables and sharing schema verified.")
        await seed_initial_marketplace()
        return
    except Exception as e:
        _pg_error = f"Migration failed: {e}"
        logger.error(f"PostgreSQL migration failed ({e}). Falling back to local SQLite.")
        _use_sqlite = True
        _init_sqlite()


def _init_sqlite():
    """Fallback SQLite setup for local dev when Coolify internal PG is unreachable."""
    global _sqlite_conn
    import sqlite3
    os.makedirs(os.path.dirname(_sqlite_path), exist_ok=True)
    _sqlite_conn = sqlite3.connect(_sqlite_path, check_same_thread=False)
    _sqlite_conn.row_factory = sqlite3.Row
    with _sqlite_conn:
        _sqlite_conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE,
                password_hash TEXT NOT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
        """)
        _sqlite_conn.execute("""
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                state TEXT NOT NULL,
                share_token TEXT UNIQUE,
                is_public INTEGER DEFAULT 0,
                public_role TEXT DEFAULT 'viewer',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
        """)
        _sqlite_conn.execute("""
            CREATE TABLE IF NOT EXISTS project_shares (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                role TEXT NOT NULL DEFAULT 'viewer',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(project_id, user_id)
            );
        """)
        _sqlite_conn.execute("""
            CREATE TABLE IF NOT EXISTS marketplace_modules (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                category TEXT NOT NULL DEFAULT 'code',
                description TEXT,
                author_id TEXT,
                author_username TEXT,
                version TEXT DEFAULT '1.0.0',
                is_public INTEGER DEFAULT 1,
                code TEXT,
                config TEXT DEFAULT '{}',
                preview_image TEXT,
                likes_count INTEGER DEFAULT 0,
                forked_from_id TEXT,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
        """)
        _sqlite_conn.execute("""
            CREATE TABLE IF NOT EXISTS user_library (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                module_id TEXT NOT NULL,
                custom_name TEXT,
                category TEXT DEFAULT 'code',
                synced_at TEXT DEFAULT CURRENT_TIMESTAMP,
                local_overrides TEXT DEFAULT '{}',
                UNIQUE(user_id, module_id)
            );
        """)
        # Run migrations on projects table if columns missing
        cur = _sqlite_conn.cursor()
        cur.execute("PRAGMA table_info(projects)")
        cols = {row["name"] for row in cur.fetchall()}
        if "share_token" not in cols:
            _sqlite_conn.execute("ALTER TABLE projects ADD COLUMN share_token TEXT")
        if "is_public" not in cols:
            _sqlite_conn.execute("ALTER TABLE projects ADD COLUMN is_public INTEGER DEFAULT 0")
        if "public_role" not in cols:
            _sqlite_conn.execute("ALTER TABLE projects ADD COLUMN public_role TEXT DEFAULT 'viewer'")
    logger.info(f"SQLite fallback database initialized at {_sqlite_path}")


_seeded = False

async def _ensure_init():
    global _pg_pool, _sqlite_conn, _seeded
    if _pg_pool is None and _sqlite_conn is None:
        await init_db()
    if not _seeded:
        _seeded = True
        try:
            await seed_initial_marketplace()
        except Exception:
            pass


# ─── User Operations ──────────────────────────────────────────────────────────

async def get_user_by_username(username: str) -> Optional[Dict[str, Any]]:
    await _ensure_init()
    username_clean = username.strip().lower()
    if not _use_sqlite and _pg_pool:
        async with _pg_pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM users WHERE LOWER(username) = $1", username_clean
            )
            return dict(row) if row else None
    else:
        cur = _sqlite_conn.cursor()
        cur.execute("SELECT * FROM users WHERE LOWER(username) = ?", (username_clean,))
        row = cur.fetchone()
        return dict(row) if row else None


async def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    await _ensure_init()
    email_clean = email.strip().lower()
    if not _use_sqlite and _pg_pool:
        async with _pg_pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM users WHERE LOWER(email) = $1", email_clean
            )
            return dict(row) if row else None
    else:
        cur = _sqlite_conn.cursor()
        cur.execute("SELECT * FROM users WHERE LOWER(email) = ?", (email_clean,))
        row = cur.fetchone()
        return dict(row) if row else None


async def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    await _ensure_init()
    if not _use_sqlite and _pg_pool:
        async with _pg_pool.acquire() as conn:
            row = await conn.fetchrow("SELECT * FROM users WHERE id = $1", user_id)
            return dict(row) if row else None
    else:
        cur = _sqlite_conn.cursor()
        cur.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        row = cur.fetchone()
        return dict(row) if row else None


async def create_user(username: str, email: Optional[str], password_hash: str) -> Dict[str, Any]:
    await _ensure_init()
    user_id = str(uuid.uuid4())
    username_clean = username.strip()
    email_clean = email.strip().lower() if email else None
    now = datetime.now(timezone.utc)

    if not _use_sqlite and _pg_pool:
        async with _pg_pool.acquire() as conn:
            row = await conn.fetchrow("""
                INSERT INTO users (id, username, email, password_hash, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $5)
                RETURNING id, username, email, created_at, updated_at
            """, user_id, username_clean, email_clean, password_hash, now)
            return dict(row)
    else:
        with _sqlite_conn:
            _sqlite_conn.execute("""
                INSERT INTO users (id, username, email, password_hash, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (user_id, username_clean, email_clean, password_hash, now.isoformat(), now.isoformat()))
        return {
            "id": user_id,
            "username": username_clean,
            "email": email_clean,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }


# ─── Projects & Permissions (Google Docs style) ───────────────────────────────

async def list_user_projects(user_id: str) -> List[Dict[str, Any]]:
    """List owned projects AND shared projects with collaborator info and role."""
    await _ensure_init()
    if not _use_sqlite and _pg_pool:
        async with _pg_pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT 
                    p.id, 
                    p.title, 
                    p.share_token, 
                    p.is_public, 
                    p.public_role,
                    p.created_at, 
                    p.updated_at,
                    p.user_id as owner_id,
                    u.username as owner_username,
                    CASE 
                        WHEN p.user_id = $1 THEN 'owner'
                        ELSE COALESCE(ps.role, 'viewer')
                    END as role,
                    (p.user_id = $1) as is_owner
                FROM projects p
                JOIN users u ON p.user_id = u.id
                LEFT JOIN project_shares ps ON ps.project_id = p.id AND ps.user_id = $1
                WHERE p.user_id = $1 OR ps.user_id = $1
                ORDER BY p.updated_at DESC
            """, user_id)
            return [dict(r) for r in rows]
    else:
        cur = _sqlite_conn.cursor()
        cur.execute("""
            SELECT 
                p.id, 
                p.title, 
                p.share_token, 
                p.is_public, 
                p.public_role,
                p.created_at, 
                p.updated_at,
                p.user_id as owner_id,
                u.username as owner_username,
                CASE 
                    WHEN p.user_id = ? THEN 'owner'
                    ELSE COALESCE(ps.role, 'viewer')
                END as role,
                (p.user_id = ?) as is_owner
            FROM projects p
            JOIN users u ON p.user_id = u.id
            LEFT JOIN project_shares ps ON ps.project_id = p.id AND ps.user_id = ?
            WHERE p.user_id = ? OR ps.user_id = ?
            ORDER BY p.updated_at DESC
        """, (user_id, user_id, user_id, user_id, user_id))
        rows = cur.fetchall()
        return [dict(r) for r in rows]


async def get_project_with_access(identifier: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Fetch project by ID or unique permalink share_token, calculating effective access role."""
    await _ensure_init()
    if not _use_sqlite and _pg_pool:
        async with _pg_pool.acquire() as conn:
            row = await conn.fetchrow("""
                SELECT 
                    p.id, 
                    p.title, 
                    p.state, 
                    p.share_token,
                    p.is_public,
                    p.public_role,
                    p.created_at, 
                    p.updated_at,
                    p.user_id as owner_id,
                    u.username as owner_username,
                    ps.role as direct_share_role
                FROM projects p
                JOIN users u ON p.user_id = u.id
                LEFT JOIN project_shares ps ON ps.project_id = p.id AND ps.user_id = $2
                WHERE p.id = $1 OR p.share_token = $1
            """, identifier, user_id)
            if not row:
                return None
            res = dict(row)
    else:
        cur = _sqlite_conn.cursor()
        cur.execute("""
            SELECT 
                p.id, 
                p.title, 
                p.state, 
                p.share_token,
                p.is_public,
                p.public_role,
                p.created_at, 
                p.updated_at,
                p.user_id as owner_id,
                u.username as owner_username,
                ps.role as direct_share_role
            FROM projects p
            JOIN users u ON p.user_id = u.id
            LEFT JOIN project_shares ps ON ps.project_id = p.id AND ps.user_id = ?
            WHERE p.id = ? OR p.share_token = ?
        """, (user_id, identifier, identifier))
        row = cur.fetchone()
        if not row:
            return None
        res = dict(row)

    # Determine role
    is_owner = (user_id is not None and user_id == res["owner_id"])
    if is_owner:
        effective_role = "owner"
    elif res.get("direct_share_role"):
        effective_role = res["direct_share_role"]
    elif res.get("is_public"):
        effective_role = res.get("public_role") or "viewer"
    else:
        # User not authorized
        return None

    res["is_owner"] = is_owner
    res["role"] = effective_role
    if isinstance(res["state"], str):
        res["state"] = json.loads(res["state"])

    return res


async def upsert_project(user_id: str, project_id: Optional[str], title: str, state: Dict[str, Any]) -> Dict[str, Any]:
    """Create or update a project, enforcing editor/owner rights."""
    await _ensure_init()
    clean_title = (title or "Document sans titre").strip()
    now = datetime.now(timezone.utc)
    state_json = json.dumps(state)

    # If project_id provided, verify permissions
    if project_id:
        existing = await get_project_with_access(project_id, user_id)
        if existing:
            if existing["role"] not in ("owner", "editor"):
                raise PermissionError("Ce document est en lecture seule (accès Lecteur). Vous ne pouvez pas le modifier.")
            pid = existing["id"]
        else:
            pid = project_id
    else:
        pid = f"proj_{uuid.uuid4().hex[:12]}"

    share_token = f"doc_{uuid.uuid4().hex[:14]}"

    if not _use_sqlite and _pg_pool:
        async with _pg_pool.acquire() as conn:
            row = await conn.fetchrow("""
                INSERT INTO projects (id, user_id, title, state, share_token, is_public, public_role, created_at, updated_at)
                VALUES ($1, $2, $3, $4::jsonb, $5, FALSE, 'viewer', $6, $6)
                ON CONFLICT (id) DO UPDATE SET
                    title = EXCLUDED.title,
                    state = EXCLUDED.state,
                    updated_at = EXCLUDED.updated_at
                RETURNING id, title, share_token, is_public, public_role, created_at, updated_at
            """, pid, user_id, clean_title, state_json, share_token, now)
            return dict(row)
    else:
        with _sqlite_conn:
            cur = _sqlite_conn.cursor()
            cur.execute("SELECT id, user_id FROM projects WHERE id = ?", (pid,))
            found = cur.fetchone()
            if found:
                cur.execute("""
                    UPDATE projects SET title = ?, state = ?, updated_at = ?
                    WHERE id = ?
                """, (clean_title, state_json, now.isoformat(), pid))
            else:
                cur.execute("""
                    INSERT INTO projects (id, user_id, title, state, share_token, is_public, public_role, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, 0, 'viewer', ?, ?)
                """, (pid, user_id, clean_title, state_json, share_token, now.isoformat(), now.isoformat()))
        return {
            "id": pid,
            "title": clean_title,
            "share_token": share_token,
            "updated_at": now.isoformat()
        }


async def delete_project(user_id: str, project_id: str) -> bool:
    """Delete a user project (only owner can delete)."""
    await _ensure_init()
    if not _use_sqlite and _pg_pool:
        async with _pg_pool.acquire() as conn:
            res = await conn.execute(
                "DELETE FROM projects WHERE id = $1 AND user_id = $2", project_id, user_id
            )
            return "DELETE 1" in res
    else:
        with _sqlite_conn:
            cur = _sqlite_conn.cursor()
            cur.execute("DELETE FROM projects WHERE id = ? AND user_id = ?", (project_id, user_id))
            return cur.rowcount > 0


# ─── Sharing & Collaborators Management ───────────────────────────────────────

async def get_project_sharing_details(project_id: str, user_id: str) -> Dict[str, Any]:
    """Retrieve collaborators list and public access configuration."""
    await _ensure_init()
    project = await get_project_with_access(project_id, user_id)
    if not project:
        raise PermissionError("Projet introuvable ou accès refusé.")

    if not _use_sqlite and _pg_pool:
        async with _pg_pool.acquire() as conn:
            collabs = await conn.fetch("""
                SELECT ps.id as share_id, ps.role, ps.created_at, u.id as user_id, u.username, u.email
                FROM project_shares ps
                JOIN users u ON ps.user_id = u.id
                WHERE ps.project_id = $1
                ORDER BY ps.created_at ASC
            """, project["id"])
            collab_list = [dict(c) for c in collabs]
    else:
        cur = _sqlite_conn.cursor()
        cur.execute("""
            SELECT ps.id as share_id, ps.role, ps.created_at, u.id as user_id, u.username, u.email
            FROM project_shares ps
            JOIN users u ON ps.user_id = u.id
            WHERE ps.project_id = ?
            ORDER BY ps.created_at ASC
        """, (project["id"],))
        collab_list = [dict(c) for c in cur.fetchall()]

    return {
        "project_id": project["id"],
        "title": project["title"],
        "share_token": project["share_token"],
        "is_public": bool(project["is_public"]),
        "public_role": project["public_role"] or "viewer",
        "is_owner": project["is_owner"],
        "owner": {
            "id": project["owner_id"],
            "username": project["owner_username"]
        },
        "collaborators": collab_list
    }


async def add_or_update_share(user_id: str, project_id: str, target_identifier: str, role: str) -> Dict[str, Any]:
    """Invite or update a collaborator role by username or email."""
    await _ensure_init()
    project = await get_project_with_access(project_id, user_id)
    if not project or not project["is_owner"]:
        raise PermissionError("Seul le propriétaire du document peut modifier les partages.")

    target_user = await get_user_by_username(target_identifier)
    if not target_user and "@" in target_identifier:
        target_user = await get_user_by_email(target_identifier)

    if not target_user:
        raise ValueError(f"Utilisateur « {target_identifier} » introuvable.")

    if target_user["id"] == user_id:
        raise ValueError("Vous êtes déjà le propriétaire de ce document.")

    clean_role = "editor" if role == "editor" else "viewer"
    share_id = f"sh_{uuid.uuid4().hex[:10]}"
    now = datetime.now(timezone.utc)

    if not _use_sqlite and _pg_pool:
        async with _pg_pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO project_shares (id, project_id, user_id, role, created_at)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (project_id, user_id) DO UPDATE SET role = EXCLUDED.role
            """, share_id, project["id"], target_user["id"], clean_role, now)
    else:
        with _sqlite_conn:
            cur = _sqlite_conn.cursor()
            cur.execute("""
                INSERT INTO project_shares (id, project_id, user_id, role, created_at)
                VALUES (?, ?, ?, ?, ?)
                ON CONFLICT(project_id, user_id) DO UPDATE SET role = excluded.role
            """, (share_id, project["id"], target_user["id"], clean_role, now.isoformat()))

    return {
        "success": True,
        "user_id": target_user["id"],
        "username": target_user["username"],
        "role": clean_role
    }


async def remove_share(user_id: str, project_id: str, target_user_id: str) -> bool:
    """Remove a collaborator from a project."""
    await _ensure_init()
    project = await get_project_with_access(project_id, user_id)
    if not project or not project["is_owner"]:
        raise PermissionError("Seul le propriétaire peut retirer l'accès à un collaborateur.")

    if not _use_sqlite and _pg_pool:
        async with _pg_pool.acquire() as conn:
            res = await conn.execute("""
                DELETE FROM project_shares WHERE project_id = $1 AND user_id = $2
            """, project["id"], target_user_id)
            return "DELETE 1" in res
    else:
        with _sqlite_conn:
            cur = _sqlite_conn.cursor()
            cur.execute("""
                DELETE FROM project_shares WHERE project_id = ? AND user_id = ?
            """, (project["id"], target_user_id))
            return cur.rowcount > 0


async def update_public_access(user_id: str, project_id: str, is_public: bool, public_role: str) -> Dict[str, Any]:
    """Toggle public link access and default role (Lecteur / Éditeur)."""
    await _ensure_init()
    project = await get_project_with_access(project_id, user_id)
    if not project or not project["is_owner"]:
        raise PermissionError("Seul le propriétaire peut modifier l'accès général.")

    clean_role = "editor" if public_role == "editor" else "viewer"

    if not _use_sqlite and _pg_pool:
        async with _pg_pool.acquire() as conn:
            await conn.execute("""
                UPDATE projects 
                SET is_public = $1, public_role = $2, updated_at = CURRENT_TIMESTAMP
                WHERE id = $3
            """, is_public, clean_role, project["id"])
    else:
        with _sqlite_conn:
            cur = _sqlite_conn.cursor()
            cur.execute("""
                UPDATE projects 
                SET is_public = ?, public_role = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (1 if is_public else 0, clean_role, project["id"]))

    return {
        "is_public": is_public,
        "public_role": clean_role
    }


# ─── Marketplace & Community Modules ──────────────────────────────────────────

def _format_module_row(row_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize marketplace module fields."""
    d = dict(row_dict)
    # Parse config if string
    cfg = d.get("config")
    if isinstance(cfg, str):
        try:
            d["config"] = json.loads(cfg)
        except Exception:
            d["config"] = {}
    elif cfg is None:
        d["config"] = {}

    # Boolean normalization
    d["is_public"] = bool(d.get("is_public", True))
    if isinstance(d.get("created_at"), datetime):
        d["created_at"] = d["created_at"].isoformat()
    if isinstance(d.get("updated_at"), datetime):
        d["updated_at"] = d["updated_at"].isoformat()
    return d


async def list_marketplace_modules(
    category: Optional[str] = None,
    search: Optional[str] = None,
    user_id: Optional[str] = None,
    include_private: bool = True
) -> List[Dict[str, Any]]:
    """
    List marketplace modules with filters:
    - category (code, orchestration, theme, etc.)
    - search query
    - user_id (only show user's own if private, or public community modules)
    """
    await _ensure_init()
    params = []
    conditions = []

    # Visibility condition: public OR owned by requesting user
    if user_id:
        if _use_sqlite:
            conditions.append("(is_public = 1 OR author_id = ?)")
        else:
            conditions.append("(is_public = TRUE OR author_id = $1)")
        params.append(user_id)
    else:
        if _use_sqlite:
            conditions.append("is_public = 1")
        else:
            conditions.append("is_public = TRUE")

    if category and category != "all":
        placeholder = f"${len(params) + 1}" if not _use_sqlite else "?"
        conditions.append(f"category = {placeholder}")
        params.append(category)

    if search:
        search_pattern = f"%{search.strip().lower()}%"
        placeholder1 = f"${len(params) + 1}" if not _use_sqlite else "?"
        placeholder2 = f"${len(params) + 2}" if not _use_sqlite else "?"
        conditions.append(f"(LOWER(name) LIKE {placeholder1} OR LOWER(description) LIKE {placeholder2})")
        params.extend([search_pattern, search_pattern])

    where_clause = " WHERE " + " AND ".join(conditions) if conditions else ""
    query = f"""
        SELECT * FROM marketplace_modules
        {where_clause}
        ORDER BY updated_at DESC
    """

    if not _use_sqlite and _pg_pool:
        async with _pg_pool.acquire() as conn:
            rows = await conn.fetch(query, *params)
            return [_format_module_row(dict(r)) for r in rows]
    else:
        cur = _sqlite_conn.cursor()
        cur.execute(query, tuple(params))
        rows = cur.fetchall()
        return [_format_module_row(dict(r)) for r in rows]


async def get_marketplace_module(module_id: str) -> Optional[Dict[str, Any]]:
    """Get single module by ID."""
    await _ensure_init()
    if not _use_sqlite and _pg_pool:
        async with _pg_pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM marketplace_modules WHERE id = $1", module_id
            )
            return _format_module_row(dict(row)) if row else None
    else:
        cur = _sqlite_conn.cursor()
        cur.execute("SELECT * FROM marketplace_modules WHERE id = ?", (module_id,))
        row = cur.fetchone()
        return _format_module_row(dict(row)) if row else None


async def upsert_marketplace_module(
    module_id: str,
    name: str,
    category: str,
    description: str,
    author_id: Optional[str] = None,
    author_username: Optional[str] = None,
    version: str = "1.0.0",
    is_public: bool = True,
    code: Optional[str] = None,
    config: Optional[Dict[str, Any]] = None,
    preview_image: Optional[str] = None,
    forked_from_id: Optional[str] = None
) -> Dict[str, Any]:
    """
    Upload or update a community module.
    Every user can modify existing modules (collaborative community edit or fork).
    """
    await _ensure_init()
    now = datetime.now(timezone.utc)
    config_dict = config or {}
    config_json = json.dumps(config_dict)

    if not _use_sqlite and _pg_pool:
        async with _pg_pool.acquire() as conn:
            # Check if exists
            existing = await conn.fetchrow("SELECT * FROM marketplace_modules WHERE id = $1", module_id)
            if existing:
                await conn.execute("""
                    UPDATE marketplace_modules
                    SET name = $2, category = $3, description = $4,
                        author_username = COALESCE($5, author_username),
                        version = $6, is_public = $7, code = $8,
                        config = $9::jsonb, preview_image = COALESCE($10, preview_image),
                        forked_from_id = COALESCE($11, forked_from_id),
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = $1
                """, module_id, name, category, description, author_username,
                    version, is_public, code, config_json, preview_image, forked_from_id)
            else:
                await conn.execute("""
                    INSERT INTO marketplace_modules (
                        id, name, category, description, author_id, author_username,
                        version, is_public, code, config, preview_image, forked_from_id,
                        created_at, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                """, module_id, name, category, description, author_id, author_username,
                    version, is_public, code, config_json, preview_image, forked_from_id)
    else:
        with _sqlite_conn:
            cur = _sqlite_conn.cursor()
            cur.execute("SELECT id, preview_image, forked_from_id, author_username FROM marketplace_modules WHERE id = ?", (module_id,))
            existing = cur.fetchone()
            if existing:
                cur.execute("""
                    UPDATE marketplace_modules
                    SET name = ?, category = ?, description = ?,
                        author_username = COALESCE(?, author_username),
                        version = ?, is_public = ?, code = ?,
                        config = ?, preview_image = COALESCE(?, preview_image),
                        forked_from_id = COALESCE(?, forked_from_id),
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                """, (name, category, description, author_username,
                      version, 1 if is_public else 0, code,
                      config_json, preview_image, forked_from_id, module_id))
            else:
                cur.execute("""
                    INSERT INTO marketplace_modules (
                        id, name, category, description, author_id, author_username,
                        version, is_public, code, config, preview_image, forked_from_id,
                        created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (module_id, name, category, description, author_id, author_username,
                      version, 1 if is_public else 0, code, config_json, preview_image, forked_from_id,
                      now.isoformat(), now.isoformat()))

    return await get_marketplace_module(module_id)


async def update_marketplace_visibility(module_id: str, is_public: bool) -> bool:
    """Toggle module visibility (visible / caché)."""
    await _ensure_init()
    if not _use_sqlite and _pg_pool:
        async with _pg_pool.acquire() as conn:
            res = await conn.execute("""
                UPDATE marketplace_modules
                SET is_public = $1, updated_at = CURRENT_TIMESTAMP
                WHERE id = $2
            """, is_public, module_id)
            return "UPDATE 1" in res
    else:
        with _sqlite_conn:
            cur = _sqlite_conn.cursor()
            cur.execute("""
                UPDATE marketplace_modules
                SET is_public = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (1 if is_public else 0, module_id))
            return cur.rowcount > 0


async def delete_marketplace_module(module_id: str, user_id: Optional[str] = None) -> bool:
    """Delete a marketplace module (owner or admin)."""
    await _ensure_init()
    mod = await get_marketplace_module(module_id)
    if not mod:
        return False
    if user_id and mod.get("author_id") and mod["author_id"] != user_id:
        raise PermissionError("Vous ne pouvez supprimer que vos propres modules.")

    if not _use_sqlite and _pg_pool:
        async with _pg_pool.acquire() as conn:
            res = await conn.execute("DELETE FROM marketplace_modules WHERE id = $1", module_id)
            return "DELETE 1" in res
    else:
        with _sqlite_conn:
            cur = _sqlite_conn.cursor()
            cur.execute("DELETE FROM marketplace_modules WHERE id = ?", (module_id,))
            return cur.rowcount > 0


# ─── User Synchronized Library ───────────────────────────────────────────────

async def list_user_library(user_id: str) -> List[Dict[str, Any]]:
    """List all modules added to user's personal cloud-synchronized library."""
    await _ensure_init()
    if not _use_sqlite and _pg_pool:
        async with _pg_pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT 
                    ul.id,
                    ul.user_id,
                    ul.module_id,
                    ul.custom_name,
                    ul.category,
                    ul.synced_at,
                    ul.local_overrides,
                    m.name as module_name,
                    m.description as module_desc,
                    m.version,
                    m.author_username,
                    m.preview_image,
                    m.is_public
                FROM user_library ul
                LEFT JOIN marketplace_modules m ON ul.module_id = m.id
                WHERE ul.user_id = $1
                ORDER BY ul.synced_at DESC
            """, user_id)
            res = []
            for r in rows:
                item = dict(r)
                if isinstance(item.get("local_overrides"), str):
                    try: item["local_overrides"] = json.loads(item["local_overrides"])
                    except Exception: item["local_overrides"] = {}
                res.append(item)
            return res
    else:
        cur = _sqlite_conn.cursor()
        cur.execute("""
            SELECT 
                ul.id,
                ul.user_id,
                ul.module_id,
                ul.custom_name,
                ul.category,
                ul.synced_at,
                ul.local_overrides,
                m.name as module_name,
                m.description as module_desc,
                m.version,
                m.author_username,
                m.preview_image,
                m.is_public
            FROM user_library ul
            LEFT JOIN marketplace_modules m ON ul.module_id = m.id
            WHERE ul.user_id = ?
            ORDER BY ul.synced_at DESC
        """, (user_id,))
        rows = cur.fetchall()
        res = []
        for r in rows:
            item = dict(r)
            if isinstance(item.get("local_overrides"), str):
                try: item["local_overrides"] = json.loads(item["local_overrides"])
                except Exception: item["local_overrides"] = {}
            res.append(item)
        return res


async def add_to_user_library(
    user_id: str,
    module_id: str,
    custom_name: Optional[str] = None,
    category: str = "code",
    local_overrides: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """Add a module to user library, keeping it synchronized."""
    await _ensure_init()
    lib_id = f"lib_{uuid.uuid4().hex[:12]}"
    overrides_json = json.dumps(local_overrides or {})
    now = datetime.now(timezone.utc)

    if not _use_sqlite and _pg_pool:
        async with _pg_pool.acquire() as conn:
            await conn.execute("""
                INSERT INTO user_library (id, user_id, module_id, custom_name, category, synced_at, local_overrides)
                VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, $6::jsonb)
                ON CONFLICT (user_id, module_id) DO UPDATE SET
                    custom_name = COALESCE(excluded.custom_name, user_library.custom_name),
                    synced_at = CURRENT_TIMESTAMP
            """, lib_id, user_id, module_id, custom_name, category, overrides_json)
    else:
        with _sqlite_conn:
            cur = _sqlite_conn.cursor()
            cur.execute("""
                INSERT INTO user_library (id, user_id, module_id, custom_name, category, synced_at, local_overrides)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (user_id, module_id) DO UPDATE SET
                    custom_name = COALESCE(excluded.custom_name, user_library.custom_name),
                    synced_at = CURRENT_TIMESTAMP
            """, (lib_id, user_id, module_id, custom_name, category, now.isoformat(), overrides_json))

    return {"success": True, "module_id": module_id, "user_id": user_id}


async def remove_from_user_library(user_id: str, module_id: str) -> bool:
    """Remove a module from user library."""
    await _ensure_init()
    if not _use_sqlite and _pg_pool:
        async with _pg_pool.acquire() as conn:
            res = await conn.execute(
                "DELETE FROM user_library WHERE user_id = $1 AND module_id = $2",
                user_id, module_id
            )
            return "DELETE 1" in res
    else:
        with _sqlite_conn:
            cur = _sqlite_conn.cursor()
            cur.execute(
                "DELETE FROM user_library WHERE user_id = ? AND module_id = ?",
                (user_id, module_id)
            )
            return cur.rowcount > 0


async def seed_initial_marketplace():
    """Seeds the community marketplace with default modules and pre-compiled previews if empty."""
    await _ensure_init()
    try:
        # Check if already seeded
        existing = await list_marketplace_modules()
        if existing and len(existing) >= 5:
            return

        from .modules.preview_generator import compile_and_generate_preview

        seeds = [
            {
                "id": "morse_scout",
                "name": "Morse Scout Standard",
                "category": "code",
                "description": "Alphabet Morse international avec typographie militaire, délimiteurs de mots et cadence sonore.",
                "author_username": "QG ScoutRaider",
                "version": "1.2.0",
                "is_public": True,
                "code": "def encode(solution_text, options=None):\n    # Morse Scout Standard\n    morse = {'a': '.-', 'b': '-...', 'c': '-.-.', 'd': '-..', 'e': '.', 'f': '..-.', 'g': '--.', 'h': '....', 'i': '..', 'j': '.---', 'k': '-.-', 'l': '.-..', 'm': '--', 'n': '-.', 'o': '---', 'p': '.--.', 'q': '--.-', 'r': '.-.', 's': '...', 't': '-', 'u': '..-', 'v': '...-', 'w': '.--', 'x': '-..-', 'y': '-.--', 'z': '--..', ' ': '/'}\n    return ' '.join(morse.get(c.lower(), c) for c in solution_text)",
                "config": {"render_type": "text", "difficulty": 2}
            },
            {
                "id": "polybe_matrix",
                "name": "Carré de Polybe 6×6",
                "category": "code",
                "description": "Grille de substitution chiffrée 6x6 incluant l'alphabet complet et les chiffres 0-9.",
                "author_username": "Baden-Powell",
                "version": "1.0.1",
                "is_public": True,
                "code": "def encode(solution_text, options=None):\n    chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'\n    grid = {c.lower(): f'{(i//6)+1}{(i%6)+1}' for i, c in enumerate(chars)}\n    return ' '.join(grid.get(c.lower(), c) for c in solution_text)",
                "config": {"render_type": "grid", "difficulty": 3}
            },
            {
                "id": "gilwell_topo",
                "name": "Relevé Gilwell Vectoriel",
                "category": "code",
                "description": "Graphique vectoriel de navigation calculant azimuts et distances pour marche de nuit et boussole.",
                "author_username": "Gilwell Staff",
                "version": "2.0.0",
                "is_public": True,
                "code": "def encode(solution_text, segments=None):\n    # Génération SVG vectorielle d'azimut\n    return '[Vecteur topographique azimuts & distances]'",
                "config": {"render_type": "svg", "difficulty": 4}
            },
            {
                "id": "vigenere_moustachu",
                "name": "Chiffre de Vigenère",
                "category": "code",
                "description": "Cryptage poly-alphabétique classique avec clef secrète configurable.",
                "author_username": "Maître Espion",
                "version": "1.1.0",
                "is_public": True,
                "code": "def encode(solution_text, key='SCOUT'):\n    res = []\n    for i, c in enumerate(solution_text):\n        if c.isalpha():\n            shift = ord(key[i % len(key)].upper()) - 65\n            res.append(chr((ord(c.upper()) - 65 + shift) % 26 + 65))\n        else: res.append(c)\n    return ''.join(res)",
                "config": {"render_type": "text", "difficulty": 5}
            },
            {
                "id": "templier_pigpen",
                "name": "Croix des Templiers",
                "category": "code",
                "description": "Chiffrement géométrique maçonnique (Pigpen) basé sur des cadrans à points.",
                "author_username": "Chevalier",
                "version": "1.0.0",
                "is_public": True,
                "code": "def encode(solution_text, options=None):\n    return '[Tracé géométrique des symboles templiers]'",
                "config": {"render_type": "text", "difficulty": 3}
            },
            {
                "id": "orch_debutant",
                "name": "Orchestration Débutant (Niveau 1)",
                "category": "orchestration",
                "description": "Règles simples et accessibles pour jeunes éclaireurs : 80% texte clair, 20% initiation Morse.",
                "author_username": "ScoutRaider Team",
                "version": "1.0.0",
                "is_public": True,
                "code": "# Profil de diffraction CSP Débutant\nweights = {'texte_clair': 80, 'morse': 20, 'carte_simple': 0}\nmax_distance_m = 3000",
                "config": {"weights": {"texte_clair": 80, "morse": 20}, "max_proportion": 0.25}
            },
            {
                "id": "orch_intermediaire",
                "name": "Orchestration Intermédiaire (Niveau 2)",
                "category": "orchestration",
                "description": "Équilibre entre orientation carte IGN, déchiffrage Morse et lecture de terrain.",
                "author_username": "ScoutRaider Team",
                "version": "1.1.0",
                "is_public": True,
                "code": "# Profil de diffraction Intermédiaire\nweights = {'carte_simple': 35, 'morse': 25, 'gilwell': 20, 'polybe': 20}",
                "config": {"weights": {"carte_simple": 35, "morse": 25, "gilwell": 20, "polybe": 20}}
            },
            {
                "id": "orch_expert",
                "name": "Orchestration Raider Expert (Niveau 4)",
                "category": "orchestration",
                "description": "Parcours difficile avec Vigenère, franchissements longs, azimuts multiples et carte nue.",
                "author_username": "Chef de Troupe",
                "version": "2.1.0",
                "is_public": True,
                "code": "# Profil de diffraction Expert Raider\nweights = {'vigenere': 25, 'gilwell': 30, 'carte_ign': 25, 'polybe': 20}",
                "config": {"weights": {"vigenere": 25, "gilwell": 30, "carte_ign": 25, "polybe": 20}}
            },
            {
                "id": "theme_parchemin",
                "name": "Thème Parchemin d'Expédition",
                "category": "theme",
                "description": "Mise en page aux teintes sépia patinées, boussoles anciennes et typographie manuscrite.",
                "author_username": "Cartographe",
                "version": "1.0.0",
                "is_public": True,
                "code": "/* Thème CSS Paged Media Parchemin */\nbody { background-color: #f7f1e1; font-family: 'Cinzel', serif; }",
                "config": {"primary_color": "#8b5a2b", "font": "serif"}
            }
        ]

        for s in seeds:
            preview = compile_and_generate_preview(
                module_id=s["id"],
                name=s["name"],
                category=s["category"],
                code=s["code"],
                author=s["author_username"],
                version=s["version"]
            )
            await upsert_marketplace_module(
                module_id=s["id"],
                name=s["name"],
                category=s["category"],
                description=s["description"],
                author_id="system",
                author_username=s["author_username"],
                version=s["version"],
                is_public=s["is_public"],
                code=s["code"],
                config=s["config"],
                preview_image=preview
            )
        logger.info(f"Marketplace successfully seeded with {len(seeds)} community modules.")
    except Exception as e:
        logger.error(f"Error seeding marketplace: {e}")


