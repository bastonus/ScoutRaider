# app/api/auth.py - Routes d'authentification
from fastapi import APIRouter, Depends, HTTPException, status, Response, Header, Body, Query, Cookie
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Annotated

from app.database import get_db
from app.services.auth import (
    authenticate_user, create_user, create_access_token, create_refresh_token,
    decode_token, update_last_login, get_user_by_id
)
from app.schemas.auth import UserCreate, UserLogin, UserResponse, Token, TokenPayload, RefreshRequest
from app.config import settings
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


# Dependency pour récupérer l'utilisateur courant
async def get_current_user_dependency(
    authorization: Annotated[str | None, Header()] = None,
    db: AsyncSession = Depends(get_db)
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token manquant")

    token = authorization.split(" ")[1]
    payload = decode_token(token)
    if not payload or payload.type != "access":
        raise HTTPException(status_code=401, detail="Token invalide ou expiré")

    user = await get_user_by_id(db, payload.sub)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Utilisateur inactif")

    return user


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    """Inscription d'un nouvel utilisateur."""
    # Vérifier si username/email existe déjà
    from app.services.auth import get_user_by_username, get_user_by_email, create_user
    existing = await get_user_by_username(db, user_data.username)
    if existing:
        raise HTTPException(status_code=400, detail="Nom d'utilisateur déjà pris")
    existing = await get_user_by_email(db, user_data.email)
    if existing:
        raise HTTPException(status_code=400, detail="Email déjà utilisé")

    try:
        user = await create_user(db, user_data.model_dump())
        return user
    except ValueError as e:
        # Mot de passe refuse par bcrypt (ex: caractere nul)
        raise HTTPException(status_code=400, detail=f"Mot de passe invalide: {e}")
    except Exception as e:
        import traceback
        import sys
        traceback.print_exc(file=sys.stderr)
        if settings.DEBUG:
            raise HTTPException(status_code=500, detail=f"Registration failed: {type(e).__name__}: {str(e)}")
        raise HTTPException(status_code=500, detail="Erreur interne du serveur")

@router.get("/debug/test-db")
async def debug_test_db(db: AsyncSession = Depends(get_db)):
    """Test database connection."""
    from sqlalchemy import text
    result = await db.execute(text("SELECT 1"))
    return {"result": result.scalar()}


@router.post("/login", response_model=Token)
async def login(response: Response, credentials: UserLogin, db: AsyncSession = Depends(get_db)):
    """Connexion - retourne access + refresh tokens. Accepte username OU email."""
    identifier = credentials.username or credentials.email
    user = await authenticate_user(db, identifier, credentials.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identifiants invalides",
            headers={"WWW-Authenticate": "Bearer"},
        )

    await update_last_login(db, user)

    access_token = create_access_token(user.id, username=user.username, email=user.email)
    refresh_token = create_refresh_token(user.id)

    # Cookie sécurisé pour le refresh token
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=not settings.DEBUG,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path="/api/auth/refresh"
    )

    return Token(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse.model_validate(user)
    )


@router.post("/refresh", response_model=Token)
async def refresh_token(
    response: Response,
    payload: RefreshRequest | None = Body(default=None),
    refresh_token: str | None = Query(default=None, description="Refresh token (query param, legacy)"),
    refresh_cookie: str | None = Cookie(default=None, alias="refresh_token"),
    db: AsyncSession = Depends(get_db)
):
    """Rafraîchir l'access token via le body JSON, le cookie ou le query param."""
    token = None
    if payload and payload.refresh_token:
        token = payload.refresh_token
    elif refresh_cookie:
        token = refresh_cookie
    elif refresh_token:
        token = refresh_token

    if not token:
        raise HTTPException(status_code=401, detail="Refresh token manquant")

    payload_data = decode_token(token)
    if not payload_data or payload_data.type != "refresh":
        raise HTTPException(status_code=401, detail="Refresh token invalide ou expiré")

    user = await get_user_by_id(db, payload_data.sub)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Utilisateur inactif")

    new_access = create_access_token(user.id, username=user.username, email=user.email)
    new_refresh = create_refresh_token(user.id)

    response.set_cookie(
        key="refresh_token",
        value=new_refresh,
        httponly=True,
        secure=not settings.DEBUG,
        samesite="lax",
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path="/api/auth/refresh"
    )

    return Token(
        access_token=new_access,
        refresh_token=new_refresh,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=UserResponse.model_validate(user)
    )


@router.post("/logout")
async def logout(response: Response):
    """Déconnexion - supprime le cookie refresh."""
    response.delete_cookie(key="refresh_token", path="/api/auth/refresh")
    return {"message": "Déconnecté"}


@router.get("/me", response_model=UserResponse)
async def get_current_user(
    current_user: User = Depends(get_current_user_dependency)
):
    """Récupère le profil de l'utilisateur connecté."""
    return current_user