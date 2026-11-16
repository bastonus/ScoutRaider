# app/api/health.py - Health checks for DB, Garage S3, and system
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db
from app.services.s3_client import garage_client
from app.config import settings
import structlog
from botocore.exceptions import ClientError

logger = structlog.get_logger()
router = APIRouter(prefix="/health", tags=["health"])


@router.get("/")
async def health_check():
    """Basic health check - no dependencies."""
    return {"status": "ok", "service": "scoutraider-backend"}


@router.get("/db")
async def db_health_check(db: AsyncSession = Depends(get_db)):
    """Test database connectivity and basic query."""
    try:
        # Test connection
        result = await db.execute(text("SELECT 1 as test"))
        test_val = result.scalar()

        # Test tables exist
        tables_result = await db.execute(text("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
        """))
        tables = [row[0] for row in tables_result.fetchall()]

        # Check users table specifically
        users_count = 0
        if 'users' in tables:
            count_result = await db.execute(text("SELECT COUNT(*) FROM users"))
            users_count = count_result.scalar()

        return {
            "status": "ok",
            "database": "connected",
            "test_query": test_val,
            "tables": tables,
            "users_count": users_count
        }
    except Exception as e:
        logger.error("db_health_check_failed", error=str(e))
        return {
            "status": "error",
            "database": "disconnected",
            "error": str(e)
        }


@router.get("/s3")
async def s3_health_check():
    """Test Garage S3 connectivity and bucket access."""
    try:
        # Test list buckets (verifies credentials)
        buckets = garage_client.s3.list_buckets()
        bucket_names = [b['Name'] for b in buckets.get('Buckets', [])]

        # Test our specific bucket
        bucket_name = settings.GARAGE_BUCKET
        bucket_exists = bucket_name in bucket_names

        # Test put/get object (verifies read/write)
        test_key = "health-check/test.txt"
        test_content = b"health check ok"

        try:
            garage_client.s3.put_object(Bucket=bucket_name, Key=test_key, Body=test_content)
            put_ok = True
        except ClientError as e:
            put_ok = False
            put_error = str(e)

        try:
            obj = garage_client.s3.get_object(Bucket=bucket_name, Key=test_key)
            get_content = obj['Body'].read()
            get_ok = get_content == test_content
        except ClientError as e:
            get_ok = False
            get_error = str(e)

        # Cleanup
        try:
            garage_client.s3.delete_object(Bucket=bucket_name, Key=test_key)
        except:
            pass

        return {
            "status": "ok" if (bucket_exists and put_ok and get_ok) else "error",
            "s3": "connected",
            "bucket": bucket_name,
            "bucket_exists": bucket_exists,
            "all_buckets": bucket_names,
            "write_test": put_ok,
            "read_test": get_ok,
            "endpoint_url": settings.GARAGE_ENDPOINT,
            "public_url": settings.GARAGE_PUBLIC_URL,
            "region": settings.GARAGE_REGION
        }
    except Exception as e:
        logger.error("s3_health_check_failed", error=str(e))
        return {
            "status": "error",
            "s3": "disconnected",
            "error": str(e),
            "endpoint_url": settings.GARAGE_ENDPOINT,
            "public_url": settings.GARAGE_PUBLIC_URL,
            "region": settings.GARAGE_REGION
        }


@router.get("/full")
async def full_health_check(db: AsyncSession = Depends(get_db)):
    """Complete health check: DB + Garage S3 + system info."""
    # DB check
    try:
        await db.execute(text("SELECT 1"))
        db_status = "ok"
        db_error = None
    except Exception as e:
        db_status = "error"
        db_error = str(e)

    # S3 check
    try:
        garage_client.s3.list_buckets()
        s3_status = "ok"
        s3_error = None
    except Exception as e:
        s3_status = "error"
        s3_error = str(e)

    overall = "ok" if db_status == "ok" and s3_status == "ok" else "degraded"

    return {
        "status": overall,
        "database": {"status": db_status, "error": db_error},
        "s3": {"status": s3_status, "error": s3_error},
        "environment": {
            "debug": settings.DEBUG,
            "database_url_set": bool(settings.DATABASE_URL),
            "garage_bucket": settings.GARAGE_BUCKET,
            "garage_endpoint": settings.GARAGE_ENDPOINT,
            "garage_public_url": settings.GARAGE_PUBLIC_URL,
            "garage_region": settings.GARAGE_REGION
        }
    }