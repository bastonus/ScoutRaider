"""
WeasyPrint Rendering Service for ScoutRaider.
Compiles Jinja2 HTML templates into professional print-ready A4 PDF documents.
"""

import os
from pathlib import Path
from typing import List, Optional, Set
import jinja2
from weasyprint import HTML

from .models import CarnetRenderOptions, StepRenderBlock

TEMPLATES_DIR = Path(__file__).parent / "templates"


class WeasyPrintRenderService:
    """
    Compilation service generating HTML and compiling to PDF via WeasyPrint.
    """

    def __init__(self, templates_dir: Optional[Path] = None):
        self.templates_dir = templates_dir or TEMPLATES_DIR
        self.jinja_env = jinja2.Environment(
            loader=jinja2.FileSystemLoader(str(self.templates_dir)),
            autoescape=jinja2.select_autoescape(['html', 'xml'])
        )

    def load_css(self) -> str:
        css_file = self.templates_dir / "styles_paged.css"
        if css_file.exists():
            with open(css_file, "r", encoding="utf-8") as f:
                return f.read()
        return ""

    def render_html(
        self,
        steps: List[StepRenderBlock],
        options: CarnetRenderOptions
    ) -> str:
        """
        Renders the Jinja2 HTML document ready for WeasyPrint.
        """
        template = self.jinja_env.get_template("carnet.html")
        css_content = self.load_css()

        total_meters = sum(s.distance_m for s in steps)
        total_km = round(total_meters / 1000.0, 2)

        # Collect all used annexes across steps
        used_annexes: Set[str] = set()
        for s in steps:
            for a in s.annexes:
                used_annexes.add(a)

        rendered_html = template.render(
            steps=steps,
            options=options,
            css_content=css_content,
            total_distance_km=total_km,
            used_annexes=list(used_annexes)
        )
        return rendered_html

    def compile_pdf(self, html_content: str, output_path: Path) -> Path:
        """
        Compiles HTML string into a PDF file via WeasyPrint.
        """
        output_path = Path(output_path).resolve()
        output_path.parent.mkdir(parents=True, exist_ok=True)

        weasy_doc = HTML(string=html_content)
        weasy_doc.write_pdf(target=str(output_path))

        return output_path

    def generate_carnet(
        self,
        steps: List[StepRenderBlock],
        options: CarnetRenderOptions,
        output_pdf_path: Path
    ) -> Path:
        """
        End-to-end generation from step blocks to compiled PDF.
        """
        html = self.render_html(steps, options)
        return self.compile_pdf(html, output_pdf_path)
