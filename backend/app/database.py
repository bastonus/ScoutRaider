# app/database.py - Database connection and session management
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool
from sqlalchemy import inspect
from app.config import settings
import structlog

logger = structlog.get_logger()

# Async engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    poolclass=NullPool if settings.DEBUG else None,
    pool_pre_ping=True,
    pool_recycle=3600,
)

# Session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    """Dependency for FastAPI routes."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db() -> None:
    """Initialize database tables. Drop and recreate if schema mismatch."""
    async with engine.begin() as conn:
        # Check if users table exists and has correct UUID type for id
        def check_and_fix_sync(sync_conn):
            inspector = inspect(sync_conn)
            if inspector.has_table("users"):
                columns = {col["name"]: col for col in inspector.get_columns("users")}
                # If id column is not UUID type, drop all tables
                if "id" in columns and "UUID" not in str(columns["id"]["type"]).upper():
                    logger.warning("Schema mismatch detected, dropping all tables")
                    Base.metadata.drop_all(sync_conn)
            Base.metadata.create_all(sync_conn)

        await conn.run_sync(check_and_fix_sync)
    logger.info("Database initialized")


async def close_db() -> None:
    """Close database connections."""
    await engine.dispose()
    logger.info("Database connections closed")