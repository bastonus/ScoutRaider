import os
import json
from PySide6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QLabel, 
                               QScrollArea, QLineEdit, QPushButton, QGroupBox,
                               QFormLayout, QMessageBox, QComboBox)
from PySide6.QtCore import Qt

class Step5Theme(QWidget):
    def __init__(self, state_manager):
        super().__init__()
        self.state_manager = state_manager
        self.theme_file = os.path.join("config", "themes.json")
        self.themes_data = {}
        
        layout = QVBoxLayout(self)

        # Header
        header_layout = QHBoxLayout()
        header_layout.addWidget(QLabel("Éditeur Sémantique (Dynamique)"))
        
        self.btn_reload = QPushButton("Recharger depuis le fichier")
        self.btn_reload.clicked.connect(self.load_themes_file)
        header_layout.addWidget(self.btn_reload)
        
        self.btn_save = QPushButton("Sauvegarder les modifications")
        self.btn_save.clicked.connect(self.save_themes_file)
        header_layout.addWidget(self.btn_save)
        
        layout.addLayout(header_layout)

        # Selected Theme Info
        self.lbl_current_theme = QLabel("Thème actuellement sélectionné : Aucun")
        self.lbl_current_theme.setStyleSheet("font-weight: bold; color: blue;")
        layout.addWidget(self.lbl_current_theme)

        # Scroll Area for Form
        self.scroll = QScrollArea()
        self.scroll.setWidgetResizable(True)
        self.form_widget = QWidget()
        self.form_layout = QVBoxLayout(self.form_widget)
        self.scroll.setWidget(self.form_widget)
        layout.addWidget(self.scroll)

        self.field_inputs = {} # Store refs to line edits to gather data later

        self.load_themes_file()

    def load_themes_file(self):
        if not os.path.exists(self.theme_file):
            QMessageBox.warning(self, "Erreur", f"Fichier {self.theme_file} introuvable.")
            return
            
        try:
            with open(self.theme_file, 'r', encoding='utf-8') as f:
                self.themes_data = json.load(f)
            self.refresh_form()
        except Exception as e:
            QMessageBox.critical(self, "Erreur de lecture", str(e))

    def update_from_state(self):
        theme_id = self.state_manager.get_state("theme_id", "Neutre")
        self.lbl_current_theme.setText(f"Thème actuellement sélectionné : {theme_id}")
        self.refresh_form(theme_id)

    def refresh_form(self, force_theme=None):
        # Clear layout
        while self.form_layout.count():
            item = self.form_layout.takeAt(0)
            if item.widget():
                item.widget().deleteLater()

        self.field_inputs.clear()

        theme_id = force_theme or self.state_manager.get_state("theme_id", "Neutre")
        if theme_id not in self.themes_data:
            self.form_layout.addWidget(QLabel("Thème introuvable dans themes.json"))
            return

        theme_dict = self.themes_data[theme_id]
        
        self._build_recursive_form(theme_dict, self.form_layout, prefix=theme_id)
        
        self.form_layout.addStretch()

    def _build_recursive_form(self, data_dict, parent_layout, prefix=""):
        for key, value in data_dict.items():
            field_path = f"{prefix}::{key}"
            
            if isinstance(value, dict):
                group = QGroupBox(key.capitalize())
                group_layout = QFormLayout()
                self._build_recursive_form(value, group_layout, field_path)
                group.setLayout(group_layout)
                parent_layout.addWidget(group)
                
            elif isinstance(value, list):
                # Représenter les listes sous forme de texte séparé par des virgules
                str_val = " | ".join(str(v) for v in value)
                line_edit = QLineEdit(str_val)
                self.field_inputs[field_path] = (line_edit, type(value))
                
                if isinstance(parent_layout, QFormLayout):
                    parent_layout.addRow(QLabel(key), line_edit)
                else:
                    row_layout = QHBoxLayout()
                    row_layout.addWidget(QLabel(key))
                    row_layout.addWidget(line_edit)
                    parent_layout.addLayout(row_layout)
                    
            else:
                line_edit = QLineEdit(str(value))
                self.field_inputs[field_path] = (line_edit, type(value))
                
                if isinstance(parent_layout, QFormLayout):
                    parent_layout.addRow(QLabel(key), line_edit)
                else:
                    row_layout = QHBoxLayout()
                    row_layout.addWidget(QLabel(key))
                    row_layout.addWidget(line_edit)
                    parent_layout.addLayout(row_layout)

    def save_themes_file(self):
        theme_id = self.state_manager.get_state("theme_id", "Neutre")
        if theme_id not in self.themes_data:
            return

        for path, (widget, orig_type) in self.field_inputs.items():
            parts = path.split("::")
            if parts[0] != theme_id:
                continue
                
            # Traverse to the right dictionary level
            curr = self.themes_data[theme_id]
            for p in parts[1:-1]:
                curr = curr[p]
                
            last_key = parts[-1]
            val = widget.text()
            
            if orig_type == list:
                # Split back by the custom separator
                curr[last_key] = [v.strip() for v in val.split('|') if v.strip()]
            elif orig_type == int:
                try: curr[last_key] = int(val)
                except: pass
            else:
                curr[last_key] = val

        try:
            with open(self.theme_file, 'w', encoding='utf-8') as f:
                json.dump(self.themes_data, f, indent=2, ensure_ascii=False)
            QMessageBox.information(self, "Succès", "Thème sauvegardé localement.")
        except Exception as e:
            QMessageBox.critical(self, "Erreur", str(e))
