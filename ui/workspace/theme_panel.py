"""
Theme Panel — Sélecteur de thème graphique pour le carnet PDF.
"""
import os
import sys
import json

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, PROJECT_ROOT)

from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel,
    QComboBox, QGroupBox, QScrollArea, QPushButton
)

class ThemePanel(QWidget):
    def __init__(self, state_manager):
        super().__init__()
        self.setObjectName("theme_panel_root")
        self.state_manager = state_manager
        
        # Theme inherits from global style.qss (Photoshop CC dark)
        
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        inner = QWidget()
        layout = QVBoxLayout(inner)
        layout.setContentsMargins(10, 8, 10, 8)
        layout.setSpacing(12)
        
        grp_theme = QGroupBox("STYLE DU CARNET PDF")
        theme_layout = QHBoxLayout(grp_theme)
        
        self.combo_theme = QComboBox()
        self._load_themes()
        self.combo_theme.currentTextChanged.connect(lambda t: self.state_manager.update_state("theme_id", t))
        
        theme_layout.addWidget(QLabel("Thème :"))
        theme_layout.addWidget(self.combo_theme, 1)
        
        self.btn_edit_themes = QPushButton("Gérer les thèmes...")
        self.btn_edit_themes.clicked.connect(self._open_theme_editor)
        theme_layout.addWidget(self.btn_edit_themes)
        
        layout.addWidget(grp_theme)
        layout.addStretch()
        
        scroll.setWidget(inner)
        main_vbox = QVBoxLayout(self)
        main_vbox.setContentsMargins(0,0,0,0)
        main_vbox.addWidget(scroll)

    def _open_theme_editor(self):
        from ui.workspace.theme_editor_panel import ThemeEditorDialog
        dlg = ThemeEditorDialog(self)
        if dlg.exec():
            curr = self.combo_theme.currentText()
            self.combo_theme.clear()
            self._load_themes()
            if curr in [self.combo_theme.itemText(i) for i in range(self.combo_theme.count())]:
                self.combo_theme.setCurrentText(curr)

    def _load_themes(self):
        theme_file = os.path.join(PROJECT_ROOT, 'config', 'themes.json')
        themes = ["Neutre", "Carnet_Contrebandier", "Aventures_Maritimes"] # Fallback
        if os.path.exists(theme_file):
            try:
                with open(theme_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    themes = [k for k in data.keys() if k != "_help"]
            except Exception as e:
                print(f"Erreur chargement themes.json: {e}")
        self.combo_theme.addItems(themes)

    def refresh_from_state(self):
        self.combo_theme.setCurrentText(self.state_manager.get_state("theme_id", "Neutre"))

    def set_state_manager(self, state_manager):
        """Rebind this panel to a different StateManager (multi-tab support)."""
        self.state_manager = state_manager
        self.refresh_from_state()

