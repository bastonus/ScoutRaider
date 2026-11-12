"""
auth.py — Authentication helpers (Password hashing, JWT generation & verification)
"""

import os
import time
import hmac
import hashlib
import jwt
from typing import Optional, Dict, Any
from fastapi import Header, HTTPException, status

JWT_SECRET = os.getenv("JWT_SECRET", "scoutraider-super-secret-key-coolify-2026-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_SECONDS = 60 * 60 * 24 * 30  # 30 days


def hash_password(password: str) -> str:
    """Hash password using bcrypt if available, else HMAC-SHA256 with salt."""
    try:
        import bcrypt
        salt = bcrypt.gensalt(rounds=12)
        return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")
    except Exception:
        salt = os.urandom(16).hex()
        digest = hashlib.sha256((salt + password).encode("utf-8")).hexdigest()
        return f"sha256${salt}${digest}"


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against stored hash."""
    try:
        if hashed_password.startswith("$2b$") or hashed_password.startswith("$2a$"):
            import bcrypt
            return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
        elif hashed_password.startswith("sha256$"):
            parts = hashed_password.split("$")
            if len(parts) == 3:
                _, salt, digest = parts
                test_digest = hashlib.sha256((salt + plain_password).encode("utf-8")).hexdigest()
                return hmac.compare_digest(digest, test_digest)
    except Exception:
        pass
    return False


def create_access_token(user_id: str, username: str, email: Optional[str] = None) -> str:
    """Generate signed JWT token."""
    now = int(time.time())
    payload = {
        "sub": user_id,
        "username": username,
        "email": email or "",
        "iat": now,
        "exp": now + JWT_EXPIRATION_SECONDS
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decode and validate JWT token."""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except Exception:
        return None


async def get_current_user_optional(authorization: Optional[str] = Header(None)) -> Optional[Dict[str, Any]]:
    """Optional authentication dependency (returns None if not authenticated or guest)."""
    if not authorization:
        return None
    
    parts = authorization.split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    
    token = parts[1]
    payload = decode_access_token(token)
    return payload


async def get_current_user(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """Strict authentication dependency (raises 401 if missing or invalid)."""
    user = await get_current_user_optional(authorization)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expirée ou non authentifiée. Veuillez vous connecter.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user
