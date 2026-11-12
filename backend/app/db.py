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

_pg_pool = None
_use_sqlite = False
_sqlite_conn = None
_sqlite_path = os.path.join(os.path.dirname(__file__), "storage", "local_fallback.db")


async def init_db():
    """Initialize DB connection and run migrations."""
    global _pg_pool, _use_sqlite

    pg_url = DATABASE_URL

    try:
        import asyncpg
        logger.info("Connecting to PostgreSQL database...")
        _pg_pool = await asyncio.wait_for(
            asyncpg.create_pool(
                dsn=pg_url,
                min_size=1,
                max_size=10,
                command_timeout=60
            ),
            timeout=8.0
        )
        logger.info("Successfully connected to PostgreSQL database.")
        _use_sqlite = False

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
            """)
        logger.info("PostgreSQL tables and sharing schema verified.")
        return
    except Exception as e:
        logger.warning(f"Could not connect to PostgreSQL ({e}). Falling back to local SQLite for development.")
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


async def _ensure_init():
    global _pg_pool, _sqlite_conn
    if _pg_pool is None and _sqlite_conn is None:
        await init_db()


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
