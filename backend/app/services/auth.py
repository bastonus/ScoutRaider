# app/services/auth.py - Authentication service
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
import bcrypt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid

from app.config import settings
from app.models.user import User
from app.schemas.auth import Token, TokenPayload

# NOTE: on utilise la lib `bcrypt` directement et non passlib.
# passlib 1.7.4 est incompatible avec bcrypt >= 4.1 : son auto-test du backend
# hashe un mot de passe de 255 octets pour detecter le wraparound bug, et bcrypt
# >= 4.1 leve "ValueError: password cannot be longer than 72 bytes" au lieu de
# tronquer silencieusement -> l'echec survient au premier hash/verify.
BCRYPT_ROUNDS = 12
# bcrypt n'utilise que les 72 premiers octets du mot de passe.
BCRYPT_MAX_PASSWORD_BYTES = 72


def _encode_password(password: str) -> bytes:
    """Encode un mot de passe pour bcrypt (max 72 octets, comme bcrypt le fait)."""
    encoded = password.encode("utf-8")
    if b"\x00" in encoded:
        raise ValueError("Le mot de passe ne peut pas contenir de caractère nul")
    return encoded[:BCRYPT_MAX_PASSWORD_BYTES]


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            _encode_password(plain_password),
            hashed_password.encode("utf-8"),
        )
    except (ValueError, TypeError):
        # hash invalide ou mot de passe refuse par bcrypt
        return False


def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(
        _encode_password(password),
        bcrypt.gensalt(rounds=BCRYPT_ROUNDS),
    ).decode("utf-8")


def create_access_token(user_id: uuid.UUID, expires_delta: timedelta | None = None) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode = {
        "sub": str(user_id),
        "exp": int(expire.timestamp()),
        "iat": int(datetime.now(timezone.utc).timestamp()),
        "type": "access"
    }
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(user_id: uuid.UUID) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode = {
        "sub": str(user_id),
        "exp": int(expire.timestamp()),
        "iat": int(datetime.now(timezone.utc).timestamp()),
        "type": "refresh"
    }
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> TokenPayload | None:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return TokenPayload(**payload)
    except JWTError:
        return None


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_user_by_username(db: AsyncSession, username: str) -> User | None:
    result = await db.execute(select(User).where(User.username == username))
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: uuid.UUID) -> User | None:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def authenticate_user(db: AsyncSession, username: str, password: str) -> User | None:
    user = await get_user_by_username(db, username)
    if not user:
        user = await get_user_by_email(db, username)
    if not user:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    if not user.is_active:
        return None
    return user


async def create_user(db: AsyncSession, user_data: dict) -> User:
    user = User(
        username=user_data["username"],
        email=user_data["email"],
        hashed_password=get_password_hash(user_data["password"]),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def update_last_login(db: AsyncSession, user: User) -> None:
    # Les colonnes DateTime du modele sont naives (TIMESTAMP WITHOUT TIME ZONE) :
    # on stocke donc de l'UTC naive, sinon Postgres refuse le melange
    # ("can't subtract offset-naive and offset-aware datetimes") et le login echoue.
    user.last_login = datetime.now(timezone.utc).replace(tzinfo=None)
    await db.commit()