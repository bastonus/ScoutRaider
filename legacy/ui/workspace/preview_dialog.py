# -*- coding: utf-8 -*-
"""
Preview Dialog — Modal popup for previewing exported files.

Provides tabbed previews organized by export format (PDF, HTML, etc.)
with Participant / Solution sub-tabs inside each format section.
Uses PyMuPDF (fitz) for PDF page rendering and QWebEngineView for HTML.
"""
import os
import sys

from PySide6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QTabWidget, QWidget,
    QLabel, QPushButton, QScrollArea, QFrame, QSlider, QSizePolicy,
    QMessageBox
)
from PySide6.QtCore import Qt, QSize, Signal
from PySide6.QtGui import QPixmap, QImage, QPainter

# ──────────────────────────────────────────────────────
#  THEME (Photoshop CC Dark — consistent with style.qss)
# ──────────────────────────────────────────────────────

_ACCENT      = "#2d8ceb"
_BG_PANEL    = "#535353"
_BG_DARK     = "#3c3c3c"
_BG_DARKER   = "#2b2b2b"
_TEXT         = "#cccccc"
_TEXT_DIM     = "#999999"

PREVIEW_STYLE = f"""
QDialog {{
    background-color: {_BG_PANEL};
    color: {_TEXT};
}}
QTabWidget::pane {{
    border: none;
    background-color: transparent;
}}
QTabBar::tab {{
    background-color: {_BG_DARK};
    color: {_TEXT_DIM};
    padding: 6px 14px;
    border: none;
    border-bottom: 2px solid transparent;
    font-weight: 600;
    font-size: 10px;
    min-width: 50px;
}}
QTabBar::tab:selected {{
    background-color: #4a4a4a;
    color: #ffffff;
    border-bottom: 2px solid {_ACCENT};
}}
QTabBar::tab:hover:!selected {{
    color: {_TEXT};
    background-color: #454545;
    border-bottom: 2px solid #555555;
}}
QLabel#page_label {{
    background: {_BG_DARKER};
    border: 1px solid #1d1d1d;
    padding: 0px;
}}
QPushButton {{
    background-color: #4a4a4a;
    border: 1px solid {_BG_DARK};
    color: {_TEXT};
    padding: 5px 10px;
    font-size: 11px;
}}
QPushButton:hover {{
    background-color: #555555;
    border-color: #4a4a4a;
}}
QPushButton#btn_primary {{
    background-color: {_ACCENT};
    color: white;
    border: 1px solid #2577cc;
    font-weight: 600;
}}
QPushButton#btn_primary:hover {{
    background-color: #3d9cff;
}}
QSlider::groove:horizontal {{
    border: none; height: 3px; background: #1d1d1d;
}}
QSlider::handle:horizontal {{
    background: #999999; width: 10px; height: 10px; margin: -4px 0; border: 1px solid {_BG_DARKER};
}}
QSlider::sub-page:horizontal {{ background: {_ACCENT}; }}
QScrollArea {{ border: none; background: transparent; }}
QLabel {{ color: {_TEXT}; font-size: 11px; background: transparent; }}
"""


# ──────────────────────────────────────────────────────
#  PDF PAGE RENDERER (using PyMuPDF / fitz)
# ──────────────────────────────────────────────────────

class _PdfPageWidget(QLabel):
    """Renders a single PDF page as a QPixmap at a given DPI."""

    def __init__(self, fitz_page, dpi=150, parent=None):
        super().__init__(parent)
        self._page = fitz_page
        self._dpi = dpi
        self.setAlignment(Qt.AlignCenter)
        self.setObjectName("page_label")
        self._render()

    def _render(self, dpi=None):
        if dpi is not None:
            self._dpi = dpi
        zoom = self._dpi / 72.0
        mat = None
        try:
            import fitz
            mat = fitz.Matrix(zoom, zoom)
        except Exception:
            self.setText("(PyMuPDF manquant)")
            return
        pix = self._page.get_pixmap(matrix=mat)
        img = QImage(pix.samples, pix.width, pix.height, pix.stride, QImage.Format_RGB888)
        pm = QPixmap.fromImage(img)
        self.setPixmap(pm)
        self.setFixedSize(pm.size())

    def set_dpi(self, dpi):
        self._render(dpi)


class _PdfViewer(QWidget):
    """Scrollable multi-page PDF viewer with zoom slider."""

    def __init__(self, pdf_path, parent=None):
        super().__init__(parent)
        self._path = pdf_path
        self._pages = []
        self._page_widgets = []
        self._dpi = 120

        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(4)

        # ── Toolbar ──
        tb = QHBoxLayout()
        tb.setContentsMargins(8, 4, 8, 4)

        self.lbl_info = QLabel("")
        self.lbl_info.setStyleSheet(f"color: {_TEXT_DIM}; font-size: 10px;")
        tb.addWidget(self.lbl_info)

        tb.addStretch()

        tb.addWidget(QLabel("Zoom :"))
        self.slider_zoom = QSlider(Qt.Horizontal)
        self.slider_zoom.setRange(50, 300)
        self.slider_zoom.setValue(self._dpi)
        self.slider_zoom.setFixedWidth(120)
        self.slider_zoom.valueChanged.connect(self._on_zoom)
        tb.addWidget(self.slider_zoom)
        self.lbl_zoom = QLabel(f"{self._dpi}%")
        self.lbl_zoom.setFixedWidth(36)
        tb.addWidget(self.lbl_zoom)

        btn_open = QPushButton("Ouvrir")
        btn_open.clicked.connect(lambda: self._open_native())
        tb.addWidget(btn_open)

        layout.addLayout(tb)

        # ── Scroll area with pages ──
        self._scroll = QScrollArea()
        self._scroll.setWidgetResizable(True)
        self._scroll_inner = QWidget()
        self._pages_layout = QVBoxLayout(self._scroll_inner)
        self._pages_layout.setAlignment(Qt.AlignHCenter)
        self._pages_layout.setSpacing(12)
        self._scroll.setWidget(self._scroll_inner)
        layout.addWidget(self._scroll)

        self._load_pdf()

    def _load_pdf(self):
        if not os.path.isfile(self._path):
            self.lbl_info.setText("Fichier introuvable")
            return
        try:
            import fitz
            doc = fitz.open(self._path)
            self._pages = [doc.load_page(i) for i in range(len(doc))]
            self.lbl_info.setText(f"{len(self._pages)} page(s) — {os.path.basename(self._path)}")
            for page in self._pages:
                pw = _PdfPageWidget(page, self._dpi)
                self._page_widgets.append(pw)
                self._pages_layout.addWidget(pw)
        except ImportError:
            self.lbl_info.setText("⚠ PyMuPDF (fitz) non installé — pip install PyMuPDF")
            lbl = QLabel("Installez PyMuPDF pour la prévisualisation PDF :\n\npip install PyMuPDF")
            lbl.setAlignment(Qt.AlignCenter)
            lbl.setStyleSheet(f"color: {_TEXT_DIM}; font-size: 12px; padding: 40px;")
            self._pages_layout.addWidget(lbl)
        except Exception as e:
            self.lbl_info.setText(f"Erreur: {e}")

    def _on_zoom(self, val):
        self._dpi = val
        self.lbl_zoom.setText(f"{val}%")
        for pw in self._page_widgets:
            pw.set_dpi(val)

    def _open_native(self):
        if sys.platform == "win32":
            os.startfile(self._path)
        elif sys.platform == "darwin":
            import subprocess
            subprocess.Popen(["open", self._path])
        else:
            import subprocess
            subprocess.Popen(["xdg-open", self._path])


# ──────────────────────────────────────────────────────
#  HTML VIEWER
# ──────────────────────────────────────────────────────

class _HtmlViewer(QWidget):
    """WebEngine-based HTML preview."""

    def __init__(self, html_path, parent=None):
        super().__init__(parent)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)

        try:
            from PySide6.QtWebEngineWidgets import QWebEngineView
            from PySide6.QtCore import QUrl
            web = QWebEngineView()
            web.load(QUrl.fromLocalFile(html_path))
            layout.addWidget(web)
        except ImportError:
            lbl = QLabel("⚠ QtWebEngine non disponible.\nOuvrez le fichier dans votre navigateur.")
            lbl.setAlignment(Qt.AlignCenter)
            lbl.setStyleSheet(f"color: {_TEXT_DIM}; padding: 40px;")
            layout.addWidget(lbl)

            btn = QPushButton("Ouvrir dans le navigateur")
            btn.clicked.connect(lambda: self._open_native(html_path))
            layout.addWidget(btn, alignment=Qt.AlignCenter)
            layout.addStretch()

    @staticmethod
    def _open_native(path):
        import webbrowser
        webbrowser.open(path)


# ──────────────────────────────────────────────────────
#  GENERIC FALLBACK VIEWER (Word, ODT, CSV)
# ──────────────────────────────────────────────────────

class _FallbackViewer(QWidget):
    """Simple message + open button for formats without inline preview."""

    def __init__(self, file_path, label="", parent=None):
        super().__init__(parent)
        layout = QVBoxLayout(self)
        layout.setContentsMargins(20, 40, 20, 40)

        icon_lbl = QLabel("📄")
        icon_lbl.setStyleSheet("font-size: 48px;")
        icon_lbl.setAlignment(Qt.AlignCenter)
        layout.addWidget(icon_lbl)

        name_lbl = QLabel(f"<b>{os.path.basename(file_path)}</b>")
        name_lbl.setAlignment(Qt.AlignCenter)
        name_lbl.setStyleSheet(f"font-size: 13px; color: {_TEXT};")
        layout.addWidget(name_lbl)

        desc = QLabel(f"{label}\nCe format nécessite une application externe pour la prévisualisation.")
        desc.setAlignment(Qt.AlignCenter)
        desc.setWordWrap(True)
        desc.setStyleSheet(f"color: {_TEXT_DIM}; font-size: 11px; margin: 10px 0;")
        layout.addWidget(desc)

        btn = QPushButton("Ouvrir avec l'application par défaut")
        btn.setObjectName("btn_primary")
        btn.clicked.connect(lambda: self._open(file_path))
        layout.addWidget(btn, alignment=Qt.AlignCenter)
        layout.addStretch()

    @staticmethod
    def _open(path):
        if sys.platform == "win32":
            os.startfile(path)
        elif sys.platform == "darwin":
            import subprocess
            subprocess.Popen(["open", path])
        else:
            import subprocess
            subprocess.Popen(["xdg-open", path])


# ──────────────────────────────────────────────────────
#  MAIN PREVIEW DIALOG
# ──────────────────────────────────────────────────────

class PreviewDialog(QDialog):
    """
    Modal preview window with:
      - Top-level tabs per export format (PDF, HTML, Word, ODT, CSV)
      - Inside PDF tab: sub-tabs for Participant / Solution
      - Toolbar: zoom, open native
    
    Usage:
        files = [
            ("Carnet Participant", "/path/to/pdf"),
            ("Carnet Solution",    "/path/to/pdf_soluce"),
            ("Web",                "/path/to/html"),
        ]
        dlg = PreviewDialog(files, parent)
        dlg.exec()
    """

    def __init__(self, generated_files, parent=None):
        """
        Args:
            generated_files: list of (label: str, path: str)
                Label examples: "Carnet Participant", "Carnet Solution", "Web", "Word", "ODT", "CSV"
        """
        super().__init__(parent)
        self.setWindowTitle("Prévisualisation des exports")
        self.setStyleSheet(PREVIEW_STYLE)
        self.resize(900, 700)
        self.setMinimumSize(600, 400)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)

        # ── Header ──
        header = QWidget()
        header.setStyleSheet(f"background-color: {_BG_DARK}; padding: 8px 12px;")
        h_lay = QHBoxLayout(header)
        h_lay.setContentsMargins(12, 6, 12, 6)
        title = QLabel("👁  Prévisualisation des exports")
        title.setStyleSheet(f"font-size: 13px; font-weight: bold; color: {_TEXT};")
        h_lay.addWidget(title)
        h_lay.addStretch()

        lbl_count = QLabel(f"{len(generated_files)} fichier(s)")
        lbl_count.setStyleSheet(f"color: {_TEXT_DIM}; font-size: 11px;")
        h_lay.addWidget(lbl_count)

        layout.addWidget(header)

        # ── Classify files by format ──
        # Group: { "PDF": [(label, path), ...], "HTML": [...], ... }
        groups = {}
        for label, path in generated_files:
            ext = os.path.splitext(path)[1].lower()
            fmt = self._ext_to_format(ext)
            if fmt not in groups:
                groups[fmt] = []
            groups[fmt].append((label, path))

        # ── Build top-level tabs per format ──
        self.format_tabs = QTabWidget()
        layout.addWidget(self.format_tabs)

        format_order = ["PDF", "HTML", "WORD", "ODT", "CSV"]
        for fmt in format_order:
            if fmt not in groups:
                continue
            items = groups[fmt]
            tab_widget = self._build_format_tab(fmt, items)
            icon_map = {
                "PDF": "📕", "HTML": "🌐", "WORD": "📝", "ODT": "📋", "CSV": "📊"
            }
            self.format_tabs.addTab(tab_widget, f"{icon_map.get(fmt, '📄')} {fmt}")

        # ── Bottom bar ──
        bottom = QWidget()
        bottom.setStyleSheet(f"background-color: {_BG_DARK}; border-top: 1px solid #1d1d1d;")
        b_lay = QHBoxLayout(bottom)
        b_lay.setContentsMargins(12, 6, 12, 6)
        b_lay.addStretch()
        btn_close = QPushButton("Fermer")
        btn_close.clicked.connect(self.close)
        b_lay.addWidget(btn_close)
        layout.addWidget(bottom)

    @staticmethod
    def _ext_to_format(ext):
        mapping = {
            ".pdf": "PDF",
            ".html": "HTML", ".htm": "HTML",
            ".docx": "WORD", ".doc": "WORD",
            ".odt": "ODT",
            ".csv": "CSV",
        }
        return mapping.get(ext, "AUTRE")

    def _build_format_tab(self, fmt, items):
        """Build the content for one format tab.
        If there are multiple files (e.g. Participant + Solution), use sub-tabs.
        If single file, show viewer directly.
        """
        if len(items) == 1:
            return self._build_viewer(fmt, items[0][0], items[0][1])

        # Multiple files → sub-tabs (Participant / Solution)
        sub_tabs = QTabWidget()
        for label, path in items:
            # Determine sub-tab icon based on label
            if "solution" in label.lower() or "soluce" in label.lower():
                icon = "🔑"
            else:
                icon = "👤"
            viewer = self._build_viewer(fmt, label, path)
            sub_tabs.addTab(viewer, f"{icon} {label}")
        return sub_tabs

    def _build_viewer(self, fmt, label, path):
        """Create the appropriate viewer widget for a given format."""
        if fmt == "PDF":
            return _PdfViewer(path)
        elif fmt == "HTML":
            return _HtmlViewer(path)
        else:
            return _FallbackViewer(path, label)
