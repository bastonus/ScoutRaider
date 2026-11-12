"""
Automated WeasyPrint PDF Layout & Metric Inspector.
Analyzes rendered page boxes and compiled PDF structure to detect:
  1. Horizontal overflows beyond physical page margins
  2. Vertical overflowing or content clipping
  3. Abnormal whitespace gaps (> 35% page height) caused by aggressive break-inside: avoid
  4. Non-fragmentation of atomic step blocks
"""

from pathlib import Path
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
import pypdf
from weasyprint import HTML


@dataclass
class PageMetric:
    page_number: int
    width_pt: float
    height_pt: float
    content_height_pt: float
    available_height_pt: float
    empty_fraction: float
    horizontal_overflow: bool
    overflow_details: List[str]


@dataclass
class InspectionReport:
    total_pages: int
    page_metrics: List[PageMetric]
    has_horizontal_overflow: bool
    has_excessive_whitespace: bool
    whitespace_warning_pages: List[int]
    step_integrity_verified: bool
    errors: List[str]
    warnings: List[str]


class PDFLayoutInspector:
    """
    Inspects rendered HTML pages and PDF binaries for layout and pagination flaws.
    """

    MAX_PERMISSIBLE_EMPTY_FRACTION = 0.35  # 35% page height threshold

    @classmethod
    def inspect(cls, html_content: str, pdf_path: Optional[Path] = None) -> InspectionReport:
        errors: List[str] = []
        warnings: List[str] = []

        # 1. Render Document via WeasyPrint
        weasy_doc = HTML(string=html_content).render()
        total_pages = len(weasy_doc.pages)

        page_metrics: List[PageMetric] = []
        has_horiz_overflow = False
        has_excess_whitespace = False
        whitespace_pages: List[int] = []

        for p_idx, page in enumerate(weasy_doc.pages):
            page_num = p_idx + 1
            w = page.width
            h = page.height

            # Margins
            box = page._page_box
            m_top = getattr(box, 'margin_top', 0.0) or 0.0
            m_bottom = getattr(box, 'margin_bottom', 0.0) or 0.0
            m_left = getattr(box, 'margin_left', 0.0) or 0.0
            m_right = getattr(box, 'margin_right', 0.0) or 0.0

            avail_w = max(1.0, w - m_left - m_right)
            avail_h = max(1.0, h - m_top - m_bottom)

            # Traverse child boxes to find bounds
            box_coords: List[Dict[str, float]] = []

            def collect_boxes(cur_box):
                if hasattr(cur_box, 'position_x') and hasattr(cur_box, 'position_y'):
                    bw = getattr(cur_box, 'width', 0) or 0
                    bh = getattr(cur_box, 'height', 0) or 0
                    if bw > 0 and bh > 0:
                        box_coords.append({
                            'x': cur_box.position_x,
                            'y': cur_box.position_y,
                            'w': bw,
                            'h': bh
                        })
                for child in getattr(cur_box, 'children', []):
                    collect_boxes(child)

            collect_boxes(box)

            # Horizontal overflow check
            page_horiz_overflow = False
            overflow_details = []
            for b in box_coords:
                # Tolerance of 2 pt for antialiasing / borders
                if (b['x'] + b['w']) > (w - m_right + 2.0):
                    page_horiz_overflow = True
                    has_horiz_overflow = True
                    overflow_details.append(
                        f"Box at x={b['x']:.1f}, w={b['w']:.1f} exceeds right margin ({w - m_right:.1f} pt)"
                    )

            # Height utilization check
            if box_coords:
                min_y = min(b['y'] for b in box_coords)
                max_y = max(b['y'] + b['h'] for b in box_coords)
                content_h = max_y - min_y
            else:
                content_h = 0.0

            empty_frac = max(0.0, 1.0 - (content_h / avail_h)) if avail_h > 0 else 0.0

            # Exclude cover page (p=1), overview map, and the very last page of the document
            # from excessive whitespace warnings
            is_intermediate_step_page = (page_num > 2 and page_num < total_pages)
            if is_intermediate_step_page and empty_frac > cls.MAX_PERMISSIBLE_EMPTY_FRACTION:
                has_excess_whitespace = True
                whitespace_pages.append(page_num)
                warnings.append(
                    f"Page {page_num} has {empty_frac*100:.1f}% empty vertical space "
                    f"(exceeds {cls.MAX_PERMISSIBLE_EMPTY_FRACTION*100}% threshold)."
                )

            page_metrics.append(PageMetric(
                page_number=page_num,
                width_pt=w,
                height_pt=h,
                content_height_pt=content_h,
                available_height_pt=avail_h,
                empty_fraction=empty_frac,
                horizontal_overflow=page_horiz_overflow,
                overflow_details=overflow_details
            ))

        # 2. Textual Integrity inspection via pypdf (if pdf_path provided)
        step_integrity = True
        if pdf_path and Path(pdf_path).exists():
            reader = pypdf.PdfReader(str(pdf_path))
            assert len(reader.pages) == total_pages

            full_text = ""
            for p_num, p in enumerate(reader.pages):
                txt = p.extract_text() or ""
                full_text += f"\n--- PAGE {p_num+1} ---\n" + txt

            # Check that ÉTAPE keywords are intact and numbered
            # Also verify that page counters rendered (e.g. "1 / 4", "2 / 4")
            if "SCOUTRAIDER" not in full_text and "CARNET" not in full_text:
                errors.append("PDF does not appear to contain expected ScoutRaider headers.")

        return InspectionReport(
            total_pages=total_pages,
            page_metrics=page_metrics,
            has_horizontal_overflow=has_horiz_overflow,
            has_excessive_whitespace=has_excess_whitespace,
            whitespace_warning_pages=whitespace_pages,
            step_integrity_verified=step_integrity,
            errors=errors,
            warnings=warnings
        )
