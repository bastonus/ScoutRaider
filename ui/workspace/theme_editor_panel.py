import os
import json
from PySide6.QtWidgets import (
    QDialog, QVBoxLayout, QHBoxLayout, QLabel, QPushButton, 
    QListWidget, QLineEdit, QPlainTextEdit, QGroupBox, 
    QScrollArea, QWidget, QMessageBox, QSplitter, QFormLayout
)
from PySide6.QtCore import Qt

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
THEMES_PATH = os.path.join(PROJECT_ROOT, "config", "themes.json")

class ThemeEditorDialog(QDialog):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Éditeur de Thèmes")
        self.resize(850, 650)
        self.themes_data = {}
        self.current_theme_key = None
        
        self.setStyleSheet("""
            QDialog { background-color: #2b2b2b; color: #ccc; }
            QGroupBox { border: 1px solid #444; border-radius: 5px; margin-top: 10px; padding-top: 15px; color: #fff; font-weight: bold; }
            QGroupBox::title { subcontrol-origin: margin; left: 10px; padding: 0 3px 0 3px; }
            QLineEdit, QPlainTextEdit, QListWidget { background: #1e1e1e; color: #fff; border: 1px solid #444; border-radius: 3px; padding: 4px; }
            QPushButton { background: #333; color: #fff; border: 1px solid #555; border-radius: 3px; padding: 6px 12px; }
            QPushButton:hover { background: #505050; border-color: #2d8ceb; }
            QLabel { color: #ccc; }
        """)

        self._build_ui()
        self._load_data()

    def _build_ui(self):
        main_layout = QVBoxLayout(self)
        
        splitter = QSplitter(Qt.Horizontal)
        
        # Left pane: List of themes
        left_pane = QWidget()
        left_layout = QVBoxLayout(left_pane)
        left_layout.setContentsMargins(0, 0, 0, 0)
        
        self.list_themes = QListWidget()
        self.list_themes.currentItemChanged.connect(self._on_theme_selected)
        left_layout.addWidget(QLabel("<b>Thèmes disponibles</b>"))
        left_layout.addWidget(self.list_themes)
        
        btn_layout = QHBoxLayout()
        self.btn_new = QPushButton("+ Nouveau")
        self.btn_new.clicked.connect(self._create_new_theme)
        self.btn_del = QPushButton("- Supprimer")
        self.btn_del.clicked.connect(self._delete_theme)
        self.btn_del.setStyleSheet("QPushButton:hover { border-color: #e74c3c; }")
        btn_layout.addWidget(self.btn_new)
        btn_layout.addWidget(self.btn_del)
        left_layout.addLayout(btn_layout)
        
        splitter.addWidget(left_pane)
        
        # Right pane: Form editor
        self.right_pane = QWidget()
        right_layout = QVBoxLayout(self.right_pane)
        right_layout.setContentsMargins(0, 0, 0, 0)
        
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QScrollArea.NoFrame)
        
        self.form_container = QWidget()
        form_layout = QVBoxLayout(self.form_container)
        
        # General Settings
        grp_general = QGroupBox("Général")
        flay_gen = QFormLayout(grp_general)
        self.input_name = QLineEdit()
        self.input_name.textChanged.connect(self._on_name_changed)
        self.input_poi = QLineEdit()
        self.input_vigenere = QLineEdit()
        
        flay_gen.addRow("Nom du thème:", self.input_name)
        flay_gen.addRow("Phrase POI ({poi}):", self.input_poi)
        flay_gen.addRow("Mot clé Vigenère:", self.input_vigenere)
        form_layout.addWidget(grp_general)
        
        # Narrative
        grp_narrative = QGroupBox("Phrases narratives (Une par ligne)")
        vlay_nar = QVBoxLayout(grp_narrative)
        
        hlay_nar = QHBoxLayout()
        vlay_intro = QVBoxLayout()
        vlay_intro.addWidget(QLabel("Intros:"))
        self.text_intros = QPlainTextEdit()
        vlay_intro.addWidget(self.text_intros)
        
        vlay_action = QVBoxLayout()
        vlay_action.addWidget(QLabel("Actions:"))
        self.text_actions = QPlainTextEdit()
        vlay_action.addWidget(self.text_actions)
        
        hlay_nar.addLayout(vlay_intro)
        hlay_nar.addLayout(vlay_action)
        vlay_nar.addLayout(hlay_nar)
        form_layout.addWidget(grp_narrative)
        
        # Flags
        grp_flags = QGroupBox("Épreuve des Fanions (Une par ligne)")
        flay_flags = QFormLayout(grp_flags)
        
        self.text_flag_intros = QPlainTextEdit()
        self.text_flag_intros.setMaximumHeight(60)
        self.text_flag_real = QPlainTextEdit()
        self.text_flag_real.setMaximumHeight(60)
        self.text_flag_fake = QPlainTextEdit()
        self.text_flag_fake.setMaximumHeight(60)
        self.text_flag_outro = QPlainTextEdit()
        self.text_flag_outro.setMaximumHeight(60)
        
        flay_flags.addRow("Intros:", self.text_flag_intros)
        flay_flags.addRow("Vrai fanion ({c}):", self.text_flag_real)
        flay_flags.addRow("Faux fanion ({c}):", self.text_flag_fake)
        flay_flags.addRow("Outros:", self.text_flag_outro)
        form_layout.addWidget(grp_flags)
        
        # Extracted basic Labels
        grp_labels = QGroupBox("Labels & Titres PDF")
        flay_lab = QFormLayout(grp_labels)
        self.input_filename = QLineEdit()
        self.input_maintitle = QLineEdit()
        self.input_solucetitle = QLineEdit()
        flay_lab.addRow("Nom fichier PDF:", self.input_filename)
        flay_lab.addRow("Titre principal:", self.input_maintitle)
        flay_lab.addRow("Titre solution:", self.input_solucetitle)
        form_layout.addWidget(grp_labels)
        
        scroll.setWidget(self.form_container)
        right_layout.addWidget(scroll)
        splitter.addWidget(self.right_pane)
        
        splitter.setSizes([250, 600])
        main_layout.addWidget(splitter)
        
        # Bottom Buttons
        bot_layout = QHBoxLayout()
        bot_layout.addStretch()
        btn_cancel = QPushButton("Annuler")
        btn_cancel.clicked.connect(self.reject)
        self.btn_save = QPushButton("Enregistrer et Fermer")
        self.btn_save.setStyleSheet("background: #2d8ceb; font-weight: bold;")
        self.btn_save.clicked.connect(self._save_and_close)
        bot_layout.addWidget(btn_cancel)
        bot_layout.addWidget(self.btn_save)
        main_layout.addLayout(bot_layout)
        
        self._set_form_enabled(False)

    def _load_data(self):
        if os.path.exists(THEMES_PATH):
            with open(THEMES_PATH, "r", encoding="utf-8") as f:
                self.themes_data = json.load(f)
        else:
            self.themes_data = {}
            
        self.list_themes.clear()
        for k in self.themes_data:
            if k != "_help":
                self.list_themes.addItem(k)

    def _set_form_enabled(self, enabled):
        self.form_container.setEnabled(enabled)

    def _on_theme_selected(self, current, previous):
        if previous:
            self._save_current_form_to_dict()
            
        if not current:
            self.current_theme_key = None
            self._set_form_enabled(False)
            return
            
        self.current_theme_key = current.text()
        self._populate_form_from_dict(self.current_theme_key)
        self._set_form_enabled(True)
        # Protect Neutre from rename/delete to avoid breaking fallback
        is_neutre = (self.current_theme_key == "Neutre")
        self.input_name.setEnabled(not is_neutre)
        self.btn_del.setEnabled(not is_neutre)

    def _on_name_changed(self, new_name):
        if self.current_theme_key and self.current_theme_key != "Neutre":
            item = self.list_themes.currentItem()
            if item and new_name.strip():
                item.setText(new_name.strip())

    def _populate_form_from_dict(self, key):
        t = self.themes_data.get(key, {})
        self.input_name.blockSignals(True)
        self.input_name.setText(key)
        self.input_name.blockSignals(False)
        
        self.input_poi.setText(t.get("poi", ""))
        self.input_vigenere.setText(t.get("vigenere_key", ""))
        
        self.text_intros.setPlainText("\n".join(t.get("intros", [])))
        self.text_actions.setPlainText("\n".join(t.get("actions", [])))
        
        self.text_flag_intros.setPlainText("\n".join(t.get("drapeaux_intros", [])))
        self.text_flag_real.setPlainText("\n".join(t.get("drapeaux_real", [])))
        self.text_flag_fake.setPlainText("\n".join(t.get("drapeaux_fake", [])))
        self.text_flag_outro.setPlainText("\n".join(t.get("drapeaux_outro", [])))
        
        labels = t.get("labels", {})
        self.input_filename.setText(labels.get("filename", ""))
        self.input_maintitle.setText(labels.get("main_title", ""))
        self.input_solucetitle.setText(labels.get("soluce_title", ""))

    def _save_current_form_to_dict(self):
        if not self.current_theme_key: return
        
        new_key = self.input_name.text().strip()
        if not new_key: new_key = self.current_theme_key
        
        labels = self.themes_data.get(self.current_theme_key, {}).get("labels", {})
        labels["filename"] = self.input_filename.text().strip()
        labels["main_title"] = self.input_maintitle.text().strip()
        labels["soluce_title"] = self.input_solucetitle.text().strip()
        
        new_data = {
            "intros": [x.strip() for x in self.text_intros.toPlainText().split("\n") if x.strip()],
            "actions": [x.strip() for x in self.text_actions.toPlainText().split("\n") if x.strip()],
            "poi": self.input_poi.text().strip(),
            "vigenere_key": self.input_vigenere.text().strip().upper(),
            "drapeaux_intros": [x.strip() for x in self.text_flag_intros.toPlainText().split("\n") if x.strip()],
            "drapeaux_real": [x.strip() for x in self.text_flag_real.toPlainText().split("\n") if x.strip()],
            "drapeaux_fake": [x.strip() for x in self.text_flag_fake.toPlainText().split("\n") if x.strip()],
            "drapeaux_outro": [x.strip() for x in self.text_flag_outro.toPlainText().split("\n") if x.strip()],
            "labels": labels
        }
        
        # Handle rename in dict
        if new_key != self.current_theme_key and self.current_theme_key != "Neutre":
            # delete old key
            if self.current_theme_key in self.themes_data:
                del self.themes_data[self.current_theme_key]
            self.current_theme_key = new_key
            
        self.themes_data[self.current_theme_key] = new_data

    def _create_new_theme(self):
        base_name = "Nouveau Thème"
        name = base_name
        idx = 1
        while name in self.themes_data:
            name = f"{base_name} {idx}"
            idx += 1
            
        # Copy from Neutre if possible
        neutre_copy = json.loads(json.dumps(self.themes_data.get("Neutre", {})))
        
        # Set new name logic
        self.themes_data[name] = neutre_copy
        item = self.list_themes.addItem(name)
        
        # Select the new item
        last_idx = self.list_themes.count() - 1
        self.list_themes.setCurrentRow(last_idx)
        self.input_name.setFocus()
        self.input_name.selectAll()

    def _delete_theme(self):
        if not self.current_theme_key or self.current_theme_key == "Neutre": return
        reply = QMessageBox.question(
            self, "Confirmation", 
            f"Voulez-vous vraiment supprimer le thème '{self.current_theme_key}' ?",
            QMessageBox.Yes | QMessageBox.No
        )
        if reply == QMessageBox.Yes:
            del self.themes_data[self.current_theme_key]
            row = self.list_themes.currentRow()
            self.list_themes.takeItem(row)

    def _save_and_close(self):
        self._save_current_form_to_dict()
        
        # Write back to JSON
        try:
            with open(THEMES_PATH, "w", encoding="utf-8") as f:
                json.dump(self.themes_data, f, indent=2, ensure_ascii=False)
            
            # Hot-reload in ph immediately
            import utils.pdf_helpers as ph
            ph.THEME_DATA = self.themes_data
                
            self.accept()
        except Exception as e:
            QMessageBox.critical(self, "Erreur de sauvegarde", str(e))
