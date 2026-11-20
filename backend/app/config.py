# app/config.py - Configuration via Pydantic Settings
from pydantic_settings import BaseSettings
from pydantic import Field, ConfigDict
from typing import Optional
import os


class Settings(BaseSettings):
    model_config = ConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True
    )
    # App
    APP_NAME: str = "ScoutRaider API"
    APP_VERSION: str = "0.3.14"
    DEBUG: bool = False
    API_PREFIX: str = "/api"

    # Database
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://scoutraider:scoutraider@localhost:5432/scoutraider",
        description="PostgreSQL async connection string"
    )

    # JWT Auth
    SECRET_KEY: str = Field(default="your-secret-key-change-in-production", min_length=32)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # Garage S3 (Auto-hébergé sur Coolify)
    GARAGE_ENDPOINT: str = Field(default="http://garage:3900", description="Internal Garage endpoint")
    GARAGE_PUBLIC_URL: str = Field(default="https://s3.silverhorse.fr", description="Public URL via Cloudflare tunnel")
    GARAGE_ACCESS_KEY: str = Field(default="", description="Garage access key")
    GARAGE_SECRET_KEY: str = Field(default="", description="Garage secret key")
    GARAGE_BUCKET: str = Field(default="scoutraider-assets", description="Bucket name")
    GARAGE_REGION: str = Field(default="garage", description="S3 region")

    # CORS
    CORS_ORIGINS: list[str] = Field(
        default=[
            "http://localhost:5173",
            "tauri://localhost",
            "https://scoutraider.app",
            "https://scoutraider.silverhorse.fr",
            "http://scoutraider.silverhorse.fr"
        ],
        description="Allowed CORS origins"
    )

    # WeasyPrint
    WEASYPRINT_BIN: Optional[str] = Field(default=None, description="Path to weasyprint binary if not in PATH")

    # Rate limiting
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW: int = 60  # seconds


settings = Settings()


# Database URL sync version for Alembic
def get_sync_database_url() -> str:
    """Convert asyncpg URL to psycopg2 for Alembic migrations."""
    return settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")