"""
Pytest configuration for backend tests.
Sets up test database (SQLite in-memory) and overrides dependencies.
"""

import os
import tempfile
from pathlib import Path

# Set test environment variables BEFORE importing app modules
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["DEBUG"] = "true"
os.environ["JWT_SECRET"] = "test-secret-key-for-testing-only-32-chars-min"
os.environ["SECRET_KEY"] = "test-secret-key-for-testing-only-32-chars-min"
os.environ["ALGORITHM"] = "HS256"
os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "60"
os.environ["REFRESH_TOKEN_EXPIRE_DAYS"] = "1"
os.environ["GARAGE_ENDPOINT"] = "http://localhost:3900"
os.environ["GARAGE_PUBLIC_URL"] = "https://s3.example.com"
os.environ["GARAGE_ACCESS_KEY"] = "test"
os.environ["GARAGE_SECRET_KEY"] = "test"
os.environ["GARAGE_BUCKET"] = "test-bucket"
os.environ["GARAGE_REGION"] = "garage"
os.environ["WEASYPRINT_BIN"] = ""


# Now import and configure
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import StaticPool
from app.database import Base, get_db
from app.main import app


# Create test engine
test_engine = create_async_engine(
    "sqlite+aiosqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    echo=False,
)

TestAsyncSessionLocal = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)


async def override_get_db():
    """Override database dependency for tests."""
    async with TestAsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_test_db():
    """Create all tables in test database."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    await test_engine.dispose()


@pytest.fixture(autouse=True)
def override_db_dependency(setup_test_db):
    """Override get_db dependency for each test."""
    app.dependency_overrides[get_db] = override_get_db
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    """Create test client."""
    from fastapi.testclient import TestClient
    with TestClient(app) as c:
        yield c