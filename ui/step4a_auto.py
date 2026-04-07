import os
import json
from PySide6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QLabel, 
                               QComboBox, QListWidget, QListWidgetItem,
                               QPushButton, QGroupBox, QSpinBox, QDialog,
                               QFormLayout, QMessageBox, QAbstractItemView)
from PySide6.QtCore import Qt

class OverrideDialog(QDialog):
    def __init__(self, module_name, current_overrides, parent=None):
        super().__init__(parent)
        self.setWindowTitle(f"Surcharge des règles : {module_name.capitalize()}")
        self.module_name = module_name
        self.overrides = current_overrides.copy()
        
        layout = QFormLayout(self)
        
        self.lbl_info = QLabel("Modifiez les paramètres globaux (laissez vide/0 pour utiliser la valeur par défaut) :")
        layout.addRow(self.lbl_info)
        
        # Exemple de champs génériques - dans un vrai système on lirait les defaults du module
        self.spin_max_occurrences = QSpinBox()
        self.spin_max_occurrences.setRange(0, 100)
        self.spin_max_occurrences.setValue(self.overrides.get("max_occurrences", 0))
        layout.addRow("Occurrences maximales (0 = illimité) :", self.spin_max_occurrences)

        btn_save = QPushButton("Enregistrer")
        btn_save.clicked.connect(self.accept)
        layout.addRow(btn_save)

    def get_new_overrides(self):
        val = self.spin_max_occurrences.value()
        if val > 0:
            self.overrides["max_occurrences"] = val
        elif "max_occurrences" in self.overrides:
            del self.overrides["max_occurrences"]
        return self.overrides

class Step4AAuto(QWidget):
    def __init__(self, state_manager, presets_manager):
        super().__init__()
        self.state_manager = state_manager
        self.presets = presets_manager
        
        layout = QVBoxLayout(self)

        # 1. Sélection de Thème
        theme_group = QGroupBox("Habillage Sémantique (Thème)")
        theme_layout = QHBoxLayout()
        self.combo_theme = QComboBox()
        self.populate_themes()
        self.combo_theme.currentTextChanged.connect(self.on_theme_changed)
        theme_layout.addWidget(QLabel("Thème actif :"))
        theme_layout.addWidget(self.combo_theme)
        theme_group.setLayout(theme_layout)
        layout.addWidget(theme_group)

        # 2. Gestion des Presets
        preset_group = QGroupBox("Gestionnaire de Presets")
        preset_layout = QHBoxLayout()
        
        self.combo_presets = QComboBox()
        self.populate_presets()
        self.combo_presets.currentTextChanged.connect(self.on_preset_loaded)
        
        self.btn_save_preset = QPushButton("Mettre à jour le Preset")
        self.btn_save_new = QPushButton("Sauvegarder comme nouveau")
        
        self.btn_save_preset.clicked.connect(self.save_current_preset)
        self.btn_save_new.clicked.connect(self.save_new_preset)
        
        preset_layout.addWidget(QLabel("Preset :"))
        preset_layout.addWidget(self.combo_presets)
        preset_layout.addWidget(self.btn_save_preset)
        preset_layout.addWidget(self.btn_save_new)
        preset_group.setLayout(preset_layout)
        layout.addWidget(preset_group)

        # 3. Système Drag & Drop des Poids
        drag_group = QGroupBox("Hiérarchie & Poids des Modules (Drag & Drop)")
        drag_layout = QHBoxLayout()
        
        # Liste de tous les modules dispos (Bibliothèque)
        vbox_lib = QVBoxLayout()
        vbox_lib.addWidget(QLabel("Bibliothèque de modules (Désactivés)"))
        self.list_lib = QListWidget()
        self.list_lib.setDragDropMode(QAbstractItemView.DragDrop)
        self.list_lib.setDefaultDropAction(Qt.MoveAction)
        vbox_lib.addWidget(self.list_lib)
        
        # Liste active
        vbox_active = QVBoxLayout()
        vbox_active.addWidget(QLabel("Modules Actifs (Haut = Fréquent, Bas = Rare)"))
        self.list_active = QListWidget()
        self.list_active.setDragDropMode(QAbstractItemView.DragDrop)
        self.list_active.setDefaultDropAction(Qt.MoveAction)
        self.list_active.model().rowsMoved.connect(self.recalculate_weights)
        vbox_active.addWidget(self.list_active)
        
        drag_layout.addLayout(vbox_lib)
        drag_layout.addLayout(vbox_active)
        drag_group.setLayout(drag_layout)
        layout.addWidget(drag_group)
        
        # Bouton Paramètres ⚙️
        self.btn_settings = QPushButton("⚙️ Surcharger règles du module sélectionné")
        self.btn_settings.clicked.connect(self.open_override_dialog)
        layout.addWidget(self.btn_settings)

        # Initialisation
        self.load_modules_from_registry()

    def populate_themes(self):
        theme_path = os.path.join("config", "themes.json")
        if os.path.exists(theme_path):
            with open(theme_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                self.combo_theme.addItems(list(data.keys()))
        else:
            self.combo_theme.addItems(["Neutre"])

    def populate_presets(self):
        self.combo_presets.clear()
        factory = self.presets.presets_data.get("factory", {})
        custom = self.presets.presets_data.get("custom", {})
        self.combo_presets.addItems(list(factory.keys()) + list(custom.keys()))

    def load_modules_from_registry(self):
        self.list_lib.clear()
        self.list_active.clear()
        
        reg_path = os.path.join("config", "modules_registry.json")
        modules = []
        if os.path.exists(reg_path):
            with open(reg_path, 'r', encoding='utf-8') as f:
                modules = json.load(f).get("installed", [])
        else:
             # Fallback sur les dossiers présents
             if os.path.exists("modules"):
                 modules = [d for d in os.listdir("modules") if os.path.isdir(os.path.join("modules", d))]
                 
        for mod in modules:
            item = QListWidgetItem(mod)
            item.setData(Qt.UserRole, {}) # Pour stocker les overrides futurs
            self.list_lib.addItem(item)

    def on_theme_changed(self, text):
        self.state_manager.update_state("theme_id", text)

    def on_preset_loaded(self, text):
        if not text: return
        self.presets.set_active_preset(text)
        
        # Vider les listes pour re-remplir
        self.load_modules_from_registry()
        
        weights = self.presets.get_weights()
        if not weights: return
        
        # Trier par poids descendant
        sorted_mods = sorted(weights.items(), key=lambda x: x[1], reverse=True)
        
        for mod_name, w in sorted_mods:
            # Trouver et déplacer de lib vers active
            for i in range(self.list_lib.count()):
                if self.list_lib.item(i).text() == mod_name:
                    item = self.list_lib.takeItem(i)
                    item.setData(Qt.UserRole, self.presets.get_overrides(mod_name))
                    self.list_active.addItem(item)
                    break

    def recalculate_weights(self):
        # Cette fonction s'exécute quand la liste est réorganisée (Drag & Drop)
        total = self.list_active.count()
        if total == 0: return

        new_weights = {}
        for i in range(total):
            item = self.list_active.item(i)
            # Poids dégressif linéaire simple
            weight = max(1, (total - i) * 10) 
            new_weights[item.text()] = weight
            item.setToolTip(f"Poids relatif: {weight}")
            
        # Update preset manager active data
        self.presets.active_preset_data["weights"] = new_weights

    def open_override_dialog(self):
        item = self.list_active.currentItem()
        if not item:
            QMessageBox.warning(self, "Attention", "Sélectionnez d'abord un module dans la liste active.")
            return
            
        mod_name = item.text()
        current_overrides = item.data(Qt.UserRole)
        
        dlg = OverrideDialog(mod_name, current_overrides, self)
        if dlg.exec():
            item.setData(Qt.UserRole, dlg.get_new_overrides())
            
            # Update presets manager
            if "overrides" not in self.presets.active_preset_data:
                self.presets.active_preset_data["overrides"] = {}
            self.presets.active_preset_data["overrides"][mod_name] = dlg.get_new_overrides()

    def save_current_preset(self):
        self.recalculate_weights()
        pid = self.combo_presets.currentText()
        if not pid: return
        self.presets.save_custom_preset(pid, self.presets.active_preset_data)
        QMessageBox.information(self, "Succès", "Preset mis à jour.")

    def save_new_preset(self):
        self.recalculate_weights()
        import string
        import random
        pid = "preset_" + ''.join(random.choices(string.ascii_lowercase + string.digits, k=5))
        self.presets.save_custom_preset(pid, self.presets.active_preset_data)
        self.populate_presets()
        self.combo_presets.setCurrentText(pid)
        QMessageBox.information(self, "Succès", "Nouveau preset créé et sauvegardé.")
