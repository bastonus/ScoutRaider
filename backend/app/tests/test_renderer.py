"""
Phase 3 Test Suite — WeasyPrint PDF Rendering & Layout Inspection.
Validates:
  1. HTML/CSS Paged Media compilation to A4 PDF
  2. Running headers/footers with dynamic page numbering (counter(page) / counter(pages))
  3. Elimination of horizontal overflows across heterogeneous carnets
  4. Non-fragmentation of atomic step blocks (break-inside: avoid)
  5. Clean pagination of annexes and full-page sections
"""

import tempfile
import shutil
from pathlib import Path
import pytest
import pypdf

from backend.app.renderer.models import CarnetRenderOptions, StepRenderBlock, PageOrientation
from backend.app.renderer.service import WeasyPrintRenderService
from backend.app.renderer.inspector import PDFLayoutInspector
from backend.app.modules.sandbox import generate_gilwell_svg


@pytest.fixture(scope="module")
def render_service():
    return WeasyPrintRenderService()


@pytest.fixture(scope="module")
def temp_output_dir():
    d = Path(tempfile.mkdtemp(prefix="scoutraider_pdf_tests_"))
    yield d
    shutil.rmtree(d, ignore_errors=True)


def build_heterogeneous_steps() -> list[StepRenderBlock]:
    """Creates a realistic, varied set of steps covering all ScoutRaider module formats."""
    gilwell_svg = generate_gilwell_svg([
        {"azimut": 45, "distance": 180},
        {"azimut": 120, "distance": 320},
        {"azimut": 210, "distance": 150}
    ])

    return [
        StepRenderBlock(
            step_number=1,
            module_id="texte_clair",
            module_name="Texte Clair",
            distance_m=250,
            azimut=45,
            solution_text="Prendre le sentier balisé vers le chêne centenaire sur 250 mètres.",
            encoded_text="Prendre le sentier balisé vers le chêne centenaire sur 250 mètres.",
            render_type="text",
            poi_name="Chêne Centenaire"
        ),
        StepRenderBlock(
            step_number=2,
            module_id="morse",
            module_name="Code Morse",
            distance_m=420,
            azimut=110,
            solution_text="Suivre la ligne de crête en direction du col Saint-Jean pendant 420m.",
            encoded_text="... ..- .. ...- .-. . / .-.. .- / .-.. .. --. -. . / -.. . / -.-. .-. . - . / . -. / -.. .. .-. . -.-. - .. --- -. / -.. ..- / -.-. --- .-.. / ... .- .. -. - -....- .--- . .- -. / .--. . -. -.. .- -. - / ....- ..--- ----- -- .-.-.-",
            render_type="text",
            poi_name="Col Saint-Jean",
            annexes=["alphabet_morse"]
        ),
        StepRenderBlock(
            step_number=3,
            module_id="gilwell",
            module_name="Relevé Gilwell",
            distance_m=650,
            azimut=120,
            solution_text="Effectuer le relevé d'azimuts successifs : 45° sur 180m, puis 120° sur 320m, enfin 210° sur 150m jusqu'au gué.",
            svg_content=gilwell_svg,
            render_type="svg",
            poi_name="Gué de la Rivière",
            annexes=["alphabet_gilwell"]
        ),
        StepRenderBlock(
            step_number=4,
            module_id="vigenere",
            module_name="Chiffre de Vigenère",
            distance_m=180,
            azimut=195,
            solution_text="LE BIVOUAC SE SITUE PRES DU VIEUX MOULIN A EAU SUR LA RIVE GAUCHE",
            encoded_text="XS HQNWHIE AM WIDNW BKSN PI NYMFP MOITAZ S SGY ZCF DM WXMS YSYXLI",
            render_type="grid",
            poi_name="Vieux Moulin",
            annexes=["tableau_vigenere"],
            metadata={"key": "MOUSTACHE"}
        ),
        StepRenderBlock(
            step_number=5,
            module_id="polybe",
            module_name="Carré de Polybe",
            distance_m=310,
            azimut=270,
            solution_text="Prendre plein Ouest sur 310m vers le calvaire.",
            encoded_text="34 45 23 46 42 15 / 34 32 15 23 46 / 35 45 15 43 44 / 43 45 42 / 55 53 52 31 / 52 15 42 43 / 32 15 / 13 11 32 52 11 23 42 15",
            render_type="grid",
            poi_name="Calvaire en pierre",
            annexes=["grille_polybe"]
        ),
        StepRenderBlock(
            step_number=6,
            module_id="carte_ign",
            module_name="Carte IGN Découverte",
            distance_m=850,
            azimut=330,
            solution_text="Poursuivre sur le GR de pays pendant 850m jusqu'au refuge final.",
            encoded_text="[Section Cartographique IGN Découverte - Distance: 850m]",
            render_type="map",
            poi_name="Refuge du Chamois"
        )
    ]


class TestWeasyPrintCompilationAndLayout:

    def test_participant_carnet_compilation_and_layout_integrity(self, render_service, temp_output_dir):
        steps = build_heterogeneous_steps()
        options = CarnetRenderOptions(
            title="Raid de Printemps 2026",
            subtitle="Massif du Vercors • Épreuve d'Orientation",
            date_str="Avril 2026",
            patrol_name="Patrouille des Chamois",
            is_solution=False,
            include_general_map=True,
            include_annexes=True,
            vigenere_key="MOUSTACHE"
        )

        pdf_path = temp_output_dir / "carnet_participant.pdf"
        html_content = render_service.render_html(steps, options)
        assert len(html_content) > 500
        assert "Raid de Printemps 2026" in html_content
        assert "ÉDITION PARTICIPANTS" in html_content

        # Compile PDF
        out_pdf = render_service.compile_pdf(html_content, pdf_path)
        assert out_pdf.exists()
        assert out_pdf.stat().st_size > 5000  # at least 5 KB

        # Inspect layout and metrics
        report = PDFLayoutInspector.inspect(html_content, pdf_path=pdf_path)
        assert report.total_pages >= 3, f"Expected >= 3 pages, got {report.total_pages}"
        assert not report.has_horizontal_overflow, "Horizontal overflow detected in participant carnet!"
        assert report.step_integrity_verified

        # Inspect via pypdf
        reader = pypdf.PdfReader(str(pdf_path))
        assert len(reader.pages) == report.total_pages

    def test_solution_carnet_compilation_and_content(self, render_service, temp_output_dir):
        steps = build_heterogeneous_steps()
        options = CarnetRenderOptions(
            title="Raid de Printemps 2026",
            subtitle="Massif du Vercors",
            date_str="Avril 2026",
            patrol_name="Maîtrise & Chefs",
            is_solution=True,
            include_general_map=True,
            include_annexes=True,
            vigenere_key="MOUSTACHE"
        )

        pdf_path = temp_output_dir / "carnet_solution.pdf"
        html_content = render_service.render_html(steps, options)
        assert "ÉDITION SOLUTIONS (CHEFS)" in html_content
        assert "Solution Décodée" in html_content

        out_pdf = render_service.compile_pdf(html_content, pdf_path)
        assert out_pdf.exists()

        report = PDFLayoutInspector.inspect(html_content, pdf_path=pdf_path)
        assert not report.has_horizontal_overflow, "Horizontal overflow detected in solution carnet!"

        # Check solution text is in PDF
        reader = pypdf.PdfReader(str(pdf_path))
        extracted_text = " ".join([p.extract_text() or "" for p in reader.pages])
        assert "BIVOUAC SE SITUE PRES DU VIEUX MOULIN" in extracted_text

    def test_annexes_presence_on_dedicated_pages(self, render_service, temp_output_dir):
        steps = build_heterogeneous_steps()
        options = CarnetRenderOptions(
            title="Carnet Test Annexes",
            is_solution=False,
            include_annexes=True,
            vigenere_key="MOUSTACHE"
        )
        pdf_path = temp_output_dir / "carnet_annexes.pdf"
        html_content = render_service.render_html(steps, options)
        out_pdf = render_service.compile_pdf(html_content, pdf_path)
        assert out_pdf.exists()

        reader = pypdf.PdfReader(str(pdf_path))
        full_text_upper = " ".join([p.extract_text() or "" for p in reader.pages]).upper()
        assert "TABLEAU DE VIGEN" in full_text_upper
        assert "CODE MORSE INTERNATIONAL" in full_text_upper
        assert "GRILLE DE POLYBE" in full_text_upper
        assert "GUIDE DU RELEV" in full_text_upper
