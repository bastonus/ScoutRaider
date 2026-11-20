# app/services/s3_client.py - Garage S3 client
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from typing import Optional, BinaryIO
import uuid
import structlog

from app.config import settings

logger = structlog.get_logger()


class GarageClient:
    """Client S3 pour Garage (compatible S3, path-style addressing)."""

    def __init__(self):
        self.s3 = boto3.client(
            "s3",
            endpoint_url=settings.GARAGE_ENDPOINT,
            aws_access_key_id=settings.GARAGE_ACCESS_KEY,
            aws_secret_access_key=settings.GARAGE_SECRET_KEY,
            config=Config(
                s3={"addressing_style": "path"},  # Path-style obligatoire pour Garage
                retries={"max_attempts": 3, "mode": "adaptive"}
            ),
            region_name=settings.GARAGE_REGION,
        )
        self.bucket = settings.GARAGE_BUCKET
        self.public_url = settings.GARAGE_PUBLIC_URL.rstrip("/")

    def _get_object_key(self, asset_id: str, asset_type: str = "image") -> str:
        """Génère la clé S3 selon le type d'asset."""
        prefix = {
            "font": "fonts",
            "image": "images",
            "map": "maps",
            "module": "modules",
            "package": "modules",
            "catalog": "modules"
        }.get(asset_type, "assets")
        return f"{prefix}/{asset_id}"

    def get_module_url(self, module_id: str, version: str) -> str:
        """Retourne l'URL S3 publique directe d'un module Hub v2."""
        return f"{self.public_url}/{self.bucket}/modules/{module_id}-{version}.zip"

    async def upload_module_package(
        self,
        module_id: str,
        version: str,
        data: bytes,
        metadata: Optional[dict] = None
    ) -> str:
        """Upload une archive ZIP de module Hub v2 vers Garage S3."""
        filename = f"{module_id}-{version}.zip"
        key = f"modules/{filename}"
        try:
            self.s3.put_object(
                Bucket=self.bucket,
                Key=key,
                Body=data,
                ContentType="application/zip",
                Metadata=metadata or {
                    "module_id": module_id,
                    "version": version
                },
                CacheControl="max-age=86400, public"
            )
            logger.info("module_uploaded_to_s3", module_id=module_id, version=version, key=key, size=len(data))
            return f"{self.public_url}/{self.bucket}/{key}"
        except ClientError as e:
            logger.error("module_upload_to_s3_failed", module_id=module_id, error=str(e))
            raise

    async def upload_catalog_index(self, data: bytes, filename: str = "catalog_v2.json") -> str:
        """Upload le catalogue global v2 (JSON) vers Garage S3."""
        key = f"modules/{filename}"
        try:
            self.s3.put_object(
                Bucket=self.bucket,
                Key=key,
                Body=data,
                ContentType="application/json; charset=utf-8",
                CacheControl="max-age=300, public"
            )
            logger.info("catalog_index_uploaded_to_s3", key=key, size=len(data))
            return f"{self.public_url}/{self.bucket}/{key}"
        except ClientError as e:
            logger.error("catalog_index_upload_to_s3_failed", error=str(e))
            raise

    async def download_module_package(self, module_id: str, version: str) -> bytes:
        """Télécharge l'archive ZIP d'un module depuis Garage S3."""
        filename = f"{module_id}-{version}.zip"
        key = f"modules/{filename}"
        try:
            response = self.s3.get_object(Bucket=self.bucket, Key=key)
            return response["Body"].read()
        except ClientError as e:
            if e.response["Error"]["Code"] == "NoSuchKey":
                raise FileNotFoundError(f"Module {module_id} v{version} not found in S3 bucket {self.bucket}")
            logger.error("module_download_from_s3_failed", module_id=module_id, error=str(e))
            raise

    async def upload_asset(
        self,
        asset_id: str,
        data: bytes,
        mime_type: str,
        asset_type: str = "image",
        metadata: Optional[dict] = None
    ) -> str:
        """Upload un asset vers Garage."""
        key = self._get_object_key(asset_id, asset_type)

        try:
            self.s3.put_object(
                Bucket=self.bucket,
                Key=key,
                Body=data,
                ContentType=mime_type,
                Metadata=metadata or {},
                CacheControl="max-age=31536000, public"  # 1 an
            )
            logger.info("asset_uploaded", asset_id=asset_id, key=key, size=len(data))
            return f"{self.public_url}/{self.bucket}/{key}"

        except ClientError as e:
            logger.error("asset_upload_failed", asset_id=asset_id, error=str(e))
            raise

    async def download_asset(self, asset_id: str, asset_type: str = "image") -> bytes:
        """Télécharge un asset depuis Garage."""
        key = self._get_object_key(asset_id, asset_type)

        try:
            response = self.s3.get_object(Bucket=self.bucket, Key=key)
            return response["Body"].read()

        except ClientError as e:
            if e.response["Error"]["Code"] == "NoSuchKey":
                raise FileNotFoundError(f"Asset {asset_id} not found")
            logger.error("asset_download_failed", asset_id=asset_id, error=str(e))
            raise

    async def generate_presigned_url(
        self,
        asset_id: str,
        asset_type: str = "image",
        expiry: int = 3600
    ) -> str:
        """Génère une URL signée pour accès temporaire."""
        key = self._get_object_key(asset_id, asset_type)

        try:
            url = self.s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket, "Key": key},
                ExpiresIn=expiry
            )
            return url
        except ClientError as e:
            logger.error("presigned_url_failed", asset_id=asset_id, error=str(e))
            raise

    async def delete_asset(self, asset_id: str, asset_type: str = "image") -> bool:
        """Supprime un asset de Garage."""
        key = self._get_object_key(asset_id, asset_type)

        try:
            self.s3.delete_object(Bucket=self.bucket, Key=key)
            logger.info("asset_deleted", asset_id=asset_id, key=key)
            return True
        except ClientError as e:
            logger.error("asset_delete_failed", asset_id=asset_id, error=str(e))
            raise

    async def asset_exists(self, asset_id: str, asset_type: str = "image") -> bool:
        """Vérifie si un asset existe."""
        key = self._get_object_key(asset_id, asset_type)

        try:
            self.s3.head_object(Bucket=self.bucket, Key=key)
            return True
        except ClientError as e:
            if e.response["Error"]["Code"] == "404":
                return False
            raise

    async def list_assets(self, prefix: str = "", max_keys: int = 1000) -> list[dict]:
        """Liste les assets avec un préfixe."""
        try:
            response = self.s3.list_objects_v2(
                Bucket=self.bucket,
                Prefix=prefix,
                MaxKeys=max_keys
            )
            return response.get("Contents", [])
        except ClientError as e:
            logger.error("list_assets_failed", prefix=prefix, error=str(e))
            raise


# Instance singleton
garage_client = GarageClient()