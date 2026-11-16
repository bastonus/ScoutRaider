# app/services/image_processor.py - Traitement d'images (Pillow)
from PIL import Image
from io import BytesIO
from typing import Tuple, Optional
import structlog

logger = structlog.get_logger()


# Configuration
MAX_DIMENSION = 1920
WEBP_QUALITY = 85
THUMBNAIL_SIZE = (300, 300)


def optimize_image(
    data: bytes,
    mime_type: str,
    max_dimension: int = MAX_DIMENSION,
    quality: int = WEBP_QUALITY
) -> Tuple[bytes, str, int, int]:
    """
    Optimise une image : redimensionne si nécessaire, convertit en WebP.
    Returns: (optimized_bytes, new_mime_type, width, height)
    """
    try:
        img = Image.open(BytesIO(data))

        # Convertir en RGB si nécessaire (pour WebP)
        if img.mode in ("RGBA", "LA", "P"):
            # Créer un fond blanc pour les images avec transparence
            background = Image.new("RGB", img.size, (255, 255, 255))
            if img.mode == "P":
                img = img.convert("RGBA")
            background.paste(img, mask=img.split()[-1] if img.mode in ("RGBA", "LA") else None)
            img = background
        elif img.mode != "RGB":
            img = img.convert("RGB")

        original_width, original_height = img.size

        # Redimensionner si trop grand
        if original_width > max_dimension or original_height > max_dimension:
            img.thumbnail((max_dimension, max_dimension), Image.Resampling.LANCZOS)
            logger.info("image_resized", original=f"{original_width}x{original_height}", new=f"{img.width}x{img.height}")

        # Sauvegarder en WebP
        output = BytesIO()
        img.save(output, format="WEBP", quality=quality, method=6)
        optimized_data = output.getvalue()

        new_mime_type = "image/webp"
        logger.info("image_optimized", original_size=len(data), optimized_size=len(optimized_data), format=new_mime_type)

        return optimized_data, new_mime_type, img.width, img.height

    except Exception as e:
        logger.error("image_optimization_failed", error=str(e))
        raise


def create_thumbnail(
    data: bytes,
    mime_type: str,
    size: Tuple[int, int] = THUMBNAIL_SIZE
) -> Tuple[bytes, str, int, int]:
    """Crée une vignette (thumbnail) de l'image."""
    try:
        img = Image.open(BytesIO(data))

        if img.mode in ("RGBA", "LA", "P"):
            background = Image.new("RGB", img.size, (255, 255, 255))
            if img.mode == "P":
                img = img.convert("RGBA")
            background.paste(img, mask=img.split()[-1] if img.mode in ("RGBA", "LA") else None)
            img = background
        elif img.mode != "RGB":
            img = img.convert("RGB")

        img.thumbnail(size, Image.Resampling.LANCZOS)

        output = BytesIO()
        img.save(output, format="WEBP", quality=75, method=6)

        return output.getvalue(), "image/webp", img.width, img.height

    except Exception as e:
        logger.error("thumbnail_creation_failed", error=str(e))
        raise


def get_image_info(data: bytes) -> dict:
    """Extrait les métadonnées de base d'une image."""
    try:
        img = Image.open(BytesIO(data))
        return {
            "width": img.width,
            "height": img.height,
            "format": img.format,
            "mode": img.mode,
            "size_bytes": len(data)
        }
    except Exception as e:
        logger.error("get_image_info_failed", error=str(e))
        raise


def validate_image(data: bytes, allowed_types: list[str] = None) -> bool:
    """Valide qu'un fichier est une image supportée."""
    if allowed_types is None:
        allowed_types = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp", "image/tiff"]

    try:
        img = Image.open(BytesIO(data))
        img.verify()  # Vérifie l'intégrité
        # Re-ouvrir car verify() consomme le stream
        img = Image.open(BytesIO(data))
        mime_type = Image.MIME.get(img.format)
        return mime_type in allowed_types if mime_type else False
    except Exception:
        return False