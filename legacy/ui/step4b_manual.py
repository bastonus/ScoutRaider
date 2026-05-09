import os
import json
from PySide6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QLabel, 
                               QScrollArea, QComboBox, QPushButton, QGroupBox)
from PySide6.QtCore import Qt

class Step4BManual(QWidget):
    def __init__(self, state_manager):
        super().__init__()
        self.state_manager = state_manager
        self.available_modules = self.get_available_modules()
        
        layout = QVBoxLayout(self)

        lbl_title = QLabel("Affectation Manuelle des Segments")
        lbl_title.setStyleSheet("font-size: 16px; font-weight: bold;")
        layout.addWidget(lbl_title)

        lbl_desc = QLabel("Pour chaque tronçon généré lors de la polygonalisation, choisissez le code à appliquer.")
        layout.addWidget(lbl_desc)

        self.btn_refresh = QPushButton("Rafraîchir les segments")
        self.btn_refresh.clicked.connect(self.populate_segments)
        layout.addWidget(self.btn_refresh)

        # Scroll Area for the segment list
        self.scroll = QScrollArea()
        self.scroll.setWidgetResizable(True)
        self.list_widget = QWidget()
        self.list_layout = QVBoxLayout(self.list_widget)
        self.scroll.setWidget(self.list_widget)
        layout.addWidget(self.scroll)

        self.comboboxes = {} # { segment_index : QComboBox }
        self.module_descriptions = {m: self._module_description(m) for m in self.available_modules}

    def get_available_modules(self):
        reg_path = os.path.join("config", "modules_registry.json")
        if os.path.exists(reg_path):
            with open(reg_path, 'r', encoding='utf-8') as f:
                return json.load(f).get("installed", [])
        
        # Fallback
        if os.path.exists("modules"):
            return [d for d in os.listdir("modules") if os.path.isdir(os.path.join("modules", d))]
        return []

    def populate_segments(self):
        # Nettoyage
        while self.list_layout.count():
            item = self.list_layout.takeAt(0)
            if item.widget():
                item.widget().deleteLater()
        
        self.comboboxes.clear()

        # Récupérer les segments du state_manager
        steps = self.state_manager.get_state("polygonal_steps", [])
        
        if not steps:
            # Pour la démo : générer des faux si vide (temporaire)
            steps = [{"azimut": 45, "distance": 150}, {"azimut": 180, "distance": 220}]

        saved_assignments = self.state_manager.get_state("custom_assignments", {})

        for i, step in enumerate(steps):
            group = QGroupBox(f"Segment #{i+1}")
            group_layout = QHBoxLayout()
            
            # Info du segment
            dist = step.get('distance', step.get('properties', {}).get('metrage', '?'))
            azi = step.get('azimut', step.get('properties', {}).get('azimut', '?'))
            
            lbl_info = QLabel(f"Distance : {dist}m | Azimut : {azi}°")
            group_layout.addWidget(lbl_info)

            # Dropdown des modules
            combo = QComboBox()
            combo.addItem("--- Ignorer ---")
            combo.addItems(self.available_modules)
            for idx_mod, mod_name in enumerate(self.available_modules, start=1):
                desc = self.module_descriptions.get(mod_name, "")
                if desc:
                    combo.setItemData(idx_mod, desc, Qt.ToolTipRole)
            
            # Restaurer assignation si existante
            if str(i) in saved_assignments:
                idx = combo.findText(saved_assignments[str(i)])
                if idx >= 0:
                    combo.setCurrentIndex(idx)

            combo.currentIndexChanged.connect(lambda idx, seg_idx=i: self.on_assignment_changed(seg_idx))
            self.comboboxes[str(i)] = combo

            group_layout.addWidget(combo)
            group.setLayout(group_layout)
            self.list_layout.addWidget(group)

        self.list_layout.addStretch()

    def on_assignment_changed(self, seg_idx):
        combo = self.comboboxes.get(str(seg_idx))
        if not combo: return
        
        selection = combo.currentText()
        assignments = self.state_manager.get_state("custom_assignments", {})
        
        if selection == "--- Ignorer ---":
            if str(seg_idx) in assignments:
                del assignments[str(seg_idx)]
        else:
            assignments[str(seg_idx)] = selection
            
        self.state_manager.update_state("custom_assignments", assignments)

    def update_from_state(self):
        self.populate_segments()

    @staticmethod
    def _module_description(module_name):
        """Read module description from modules/<id>/manifest.json."""
        manifest_path = os.path.join("modules", module_name, "manifest.json")
        if not os.path.exists(manifest_path):
            return ""
        try:
            with open(manifest_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return data.get("description", "") or ""
        except Exception:
            return ""
