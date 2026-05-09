"""
ProjectTab — encapsule un projet Scout complet dans un seul onglet.

Chaque ProjectTab possède :
  • state_manager  : StateManager indépendant
  • map_view       : MapView lié à ce state_manager
  • export_gallery : ExportGallery lié à ce projet

Le QTabWidget interne expose deux onglets :
  [0] Carte        — MapView
  [1] Exportation  — ExportGallery
"""

import os
import sys

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from PySide6.QtWidgets import QWidget, QVBoxLayout, QTabWidget, QLabel
from PySide6.QtCore import Signal, Qt
from PySide6.QtGui import QFont

from state_manager import StateManager
from ui.workspace.map_view import MapView
from ui.workspace.export_gallery import ExportGallery

TAB_STYLE = """
QTabWidget::pane {
    border: none;
    background: #1e1e1e;
}
QTabBar {
    background: #252525;
}
QTabBar::tab {
    background: #252525;
    color: #888888;
    padding: 5px 16px;
    border: none;
    border-bottom: 2px solid transparent;
    font-size: 11px;
    font-weight: 600;
    min-width: 60px;
}
QTabBar::tab:selected {
    color: #ffffff;
    border-bottom: 2px solid #2d8ceb;
    background: #1e1e1e;
}
QTabBar::tab:hover:!selected {
    color: #cccccc;
    background: #2a2a2a;
}
"""


class ProjectTab(QWidget):
    """
    Encapsule un projet dans un onglet.

    Signaux:
        title_changed(str)        — quand le nom du projet change
        export_requested(str, dict) — (fmt, opts) relayé depuis ExportGallery
        cancel_requested()         — annulation export relayée
    """

    title_changed     = Signal(str)
    export_requested  = Signal(str, dict)
    cancel_requested  = Signal()

    def __init__(self, parent=None):
        super().__init__(parent)

        # ── Services ──────────────────────────────────────────────────────────
        self.state_manager = StateManager()
        self._filepath: str | None = None
        self._title = "Nouveau projet"

        # ── Inner tab widget ───────────────────────────────────────────────────
        self._tabs = QTabWidget()
        self._tabs.setStyleSheet(TAB_STYLE)
        self._tabs.setDocumentMode(True)

        # -- Onglet Carte
        self.map_view = MapView(self.state_manager)
        self._tabs.addTab(self.map_view, "🗺  Carte")

        # -- Onglet Exportation
        self.export_gallery = ExportGallery()
        self.export_gallery.export_requested.connect(self.export_requested)
        self.export_gallery.cancel_requested.connect(self.cancel_requested)
        self._tabs.addTab(self.export_gallery, "📤  Exportation")

        # ── Layout ────────────────────────────────────────────────────────────
        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)
        layout.addWidget(self._tabs)

    # ─────────────────────────────────────────────────────────────────────────
    #  Public helpers
    # ─────────────────────────────────────────────────────────────────────────

    @property
    def filepath(self) -> str | None:
        return self._filepath

    @property
    def title(self) -> str:
        return self._title

    def load_project(self, path: str):
        self._filepath = path
        self._title = os.path.splitext(os.path.basename(path))[0]
        self.state_manager.load_project(path)
        self.title_changed.emit(self._title)

    def save_project(self, path: str | None = None):
        if path:
            self._filepath = path
            self._title = os.path.splitext(os.path.basename(path))[0]
            self.title_changed.emit(self._title)
        self.state_manager.save_project(self._filepath)

    def new_project(self):
        self._filepath = None
        self._title = "Nouveau projet"
        self.state_manager.new_project()
        self.title_changed.emit(self._title)

    def switch_to_export_tab(self):
        self._tabs.setCurrentIndex(1)

    # Progress forwarding (called by ScoutWorkspace)
    def start_export_progress(self):
        self.export_gallery.start_progress()
        self.switch_to_export_tab()

    def update_export_progress(self, msg: str, pct: int):
        self.export_gallery.update_progress(msg, pct)

    def finish_export_progress(self, success: bool, error_msg: str,
                                pdf_participant: str, pdf_solution: str):
        self.export_gallery.finish_progress(success, error_msg,
                                            pdf_participant, pdf_solution)

    def add_export_entry(self, label: str, path: str, fmt: str):
        self.export_gallery.add_entry(label, path, fmt)
