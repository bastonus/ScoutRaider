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
    QComboBox, QGroupBox, QScrollArea
)

class ThemePanel(QWidget):
    def __init__(self, state_manager):
        super().__init__()
        self.setObjectName("theme_panel_root")
        self.state_manager = state_manager
        
        self.setStyleSheet("""
            QWidget#theme_panel_root { background: #0f172a; }
            QGroupBox {
                font-weight: 700; font-size: 11px; color: #94a3b8;
                border: 1px solid rgba(255,255,255,0.08); border-radius: 8px;
                margin-top: 12px; padding: 10px 4px 4px 4px;
            }
            QGroupBox::title { subcontrol-origin: margin; left: 10px; padding: 0 4px; }
            QComboBox { background: #1e293b; color: #f1f5f9; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; padding: 6px 10px; font-size: 12px; }
            QComboBox::drop-down { border: none; }
            QScrollArea { border: none; background: transparent; }
            QLabel { color: #f1f5f9; }
        """)
        
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
        
        layout.addWidget(grp_theme)
        layout.addStretch()
        
        scroll.setWidget(inner)
        main_vbox = QVBoxLayout(self)
        main_vbox.setContentsMargins(0,0,0,0)
        main_vbox.addWidget(scroll)

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
