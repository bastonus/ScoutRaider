# app/services/archive.py - Gestion des archives .srproj (ZIP)
import zipfile
import json
from io import BytesIO
from typing import Dict, Any
import structlog

logger = structlog.get_logger()


class ArchiveService:
    """Service pour créer et extraire les archives .srproj."""

    @staticmethod
    def create_srproj(
        manifest: Dict[str, Any],
        assets: Dict[str, bytes]
    ) -> bytes:
        """
        Crée une archive .srproj (ZIP) contenant manifest.json + assets.

        Args:
            manifest: DocumentV2 complet (dict)
            assets: Dict {asset_id: blob_bytes}

        Returns:
            Bytes de l'archive ZIP
        """
        buffer = BytesIO()

        with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
            # 1. Manifest JSON
            zf.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2))

            # 2. Assets binaires
            for asset_id, asset_data in assets.items():
                # Trouver le chemin d'archive depuis le manifest
                archive_path = ArchiveService._find_asset_path(manifest, asset_id)
                if archive_path:
                    zf.writestr(f"assets/{archive_path}", asset_data)
                else:
                    # Fallback: utiliser l'asset_id comme nom
                    zf.writestr(f"assets/{asset_id}", asset_data)

        zip_data = buffer.getvalue()
        logger.info("srproj_created", size=len(zip_data), asset_count=len(assets))
        return zip_data

    @staticmethod
    def _find_asset_path(manifest: Dict[str, Any], asset_id: str) -> str | None:
        """Trouve le chemin d'archive d'un asset dans le manifest."""
        # Polices
        for font in manifest.get("assets", {}).get("fonts", []):
            if font.get("assetId") == asset_id:
                return font.get("path", "").lstrip("assets/")

        # Images
        for img_key, img_data in manifest.get("assets", {}).get("images", {}).items():
            if img_data.get("assetId") == asset_id:
                return img_data.get("path", "").lstrip("assets/")

        return None

    @staticmethod
    def extract_srproj(zip_data: bytes) -> tuple[Dict[str, Any], Dict[str, bytes]]:
        """
        Extrait une archive .srproj.

        Returns:
            Tuple (manifest_dict, assets_dict {asset_id: bytes})
        """
        assets = {}

        with zipfile.ZipFile(BytesIO(zip_data), "r") as zf:
            # 1. Lire manifest.json
            try:
                manifest_data = zf.read("manifest.json")
                manifest = json.loads(manifest_data.decode("utf-8"))
            except KeyError:
                raise ValueError("manifest.json introuvable dans l'archive")
            except json.JSONDecodeError as e:
                raise ValueError(f"manifest.json invalide: {e}")

            # 2. Lire les assets
            # Construire un mapping asset_id -> chemin dans l'archive
            asset_paths = {}

            for font in manifest.get("assets", {}).get("fonts", []):
                if font.get("assetId") and font.get("path"):
                    asset_paths[font["assetId"]] = font["path"]

            for img_key, img_data in manifest.get("assets", {}).get("images", {}).items():
                if img_data.get("assetId") and img_data.get("path"):
                    asset_paths[img_data["assetId"]] = img_data["path"]

            # Extraire chaque asset
            for asset_id, archive_path in asset_paths.items():
                try:
                    asset_data = zf.read(f"assets/{archive_path}")
                    assets[asset_id] = asset_data
                except KeyError:
                    logger.warning("asset_not_found_in_archive", asset_id=asset_id, path=archive_path)

        logger.info("srproj_extracted", asset_count=len(assets))
        return manifest, assets

    @staticmethod
    def validate_srproj(zip_data: bytes) -> tuple[bool, str]:
        """
        Valide une archive .srproj sans l'extraire complètement.

        Returns:
            Tuple (is_valid, error_message)
        """
        try:
            with zipfile.ZipFile(BytesIO(zip_data), "r") as zf:
                # Vérifier manifest.json
                if "manifest.json" not in zf.namelist():
                    return False, "manifest.json manquant"

                # Lire et valider le manifest
                manifest_data = zf.read("manifest.json")
                manifest = json.loads(manifest_data.decode("utf-8"))

                # Vérifier schemaVersion
                if manifest.get("schemaVersion") != "2.0":
                    return False, f"schemaVersion invalide: {manifest.get('schemaVersion')} (attendu: 2.0)"

                # Vérifier champs requis
                required_fields = ["id", "title", "assets", "pageLayout", "blocks", "settings"]
                for field in required_fields:
                    if field not in manifest:
                        return False, f"Champ requis manquant: {field}"

                return True, "OK"

        except zipfile.BadZipFile:
            return False, "Fichier ZIP corrompu ou invalide"
        except json.JSONDecodeError as e:
            return False, f"manifest.json invalide: {e}"
        except Exception as e:
            return False, f"Erreur de validation: {e}"


# Instance singleton
archive_service = ArchiveService()