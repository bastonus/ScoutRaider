# app/services/pdf_generator.py - Génération PDF via WeasyPrint
import weasyprint
from weasyprint import HTML, CSS
from typing import Optional, Dict, Any
import tempfile
import os
import structlog

logger = structlog.get_logger()


class PDFGenerator:
    """Générateur PDF avec WeasyPrint pour le rendu fidèle du HTML."""

    def __init__(self):
        # Polices par défaut pour les chiffrements
        self.font_faces = """
        @font-face {
            font-family: 'Morse';
            src: url('fonts/morse.woff2') format('woff2');
            font-weight: normal;
            font-style: normal;
        }
        @font-face {
            font-family: 'TemplarsCipherPlus';
            src: url('fonts/templier.woff2') format('woff2');
            font-weight: normal;
            font-style: normal;
        }
        @font-face {
            font-family: 'Maritime';
            src: url('fonts/maritime.woff2') format('woff2');
            font-weight: normal;
            font-style: normal;
        }
        """

    def generate_pdf(
        self,
        html_content: str,
        base_url: str = "",
        page_size: str = "A4",
        margins: Dict[str, str] = None,
        extra_css: str = ""
    ) -> bytes:
        """
        Génère un PDF depuis du HTML.

        Args:
            html_content: HTML complet avec <html>, <head>, <body>
            base_url: URL de base pour résoudre les assets relatifs
            page_size: Taille de page (A4, A5, Letter, etc.)
            margins: Dictionnaire {top, bottom, left, right} en mm
            extra_css: CSS additionnel à injecter
        """
        if margins is None:
            margins = {"top": "20mm", "bottom": "20mm", "left": "15mm", "right": "15mm"}

        # CSS pour @page
        page_css = f"""
        @page {{
            size: {page_size};
            margin-top: {margins['top']};
            margin-bottom: {margins['bottom']};
            margin-left: {margins['left']};
            margin-right: {margins['right']};
        }}
        """

        # CSS combiné
        combined_css = self.font_faces + page_css + extra_css

        try:
            # Créer le document HTML
            html_doc = HTML(string=html_content, base_url=base_url)

            # Générer le PDF
            pdf_bytes = html_doc.write_pdf(
                stylesheets=[CSS(string=combined_css)],
                presentational_hints=True
            )

            logger.info("pdf_generated", size=len(pdf_bytes))
            return pdf_bytes

        except Exception as e:
            logger.error("pdf_generation_failed", error=str(e))
            raise

    def generate_pdf_to_file(
        self,
        html_content: str,
        output_path: str,
        **kwargs
    ) -> None:
        """Génère un PDF et l'écrit directement dans un fichier."""
        pdf_bytes = self.generate_pdf(html_content, **kwargs)
        with open(output_path, "wb") as f:
            f.write(pdf_bytes)
        logger.info("pdf_saved", path=output_path, size=len(pdf_bytes))


# Instance singleton
pdf_generator = PDFGenerator()


async def generate_pdf_from_html(html: str, output_path: str, options: Dict[str, Any] = None) -> bool:
    """
    Fonction utilitaire pour générer un PDF (compatible avec l'ancien code Electron).
    """
    try:
        opts = options or {}
        pdf_generator.generate_pdf_to_file(
            html_content=html,
            output_path=output_path,
            base_url=opts.get("base_url", ""),
            page_size=opts.get("page_size", "A4"),
            margins=opts.get("margins"),
            extra_css=opts.get("extra_css", "")
        )
        return True
    except Exception as e:
        logger.error("pdf_generation_failed", error=str(e), output_path=output_path)
        return False