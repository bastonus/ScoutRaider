"""
Difficulty Panel — Panneau principal de distribution des épreuves.

Architecture :
  - Mode AUTO (prioritaire)  : l'orchestrateur choisit et place toutes les épreuves
    selon les règles de rythme, distance, POI, etc. Ce mode est l'approche recommandée.
  - Mode MANUEL (secondaire) : override segment par segment, avec validation des
    contraintes en temps réel (avertissements visuels si une règle est violée).
"""
import os
import sys
import json

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, PROJECT_ROOT)

from PySide6.QtWidgets import (
    QWidget, QVBoxLayout, QHBoxLayout, QLabel, QPushButton,
    QComboBox, QGroupBox, QScrollArea, QMessageBox, QFrame,
    QDialog, QFormLayout, QSpinBox, QLineEdit, QDialogButtonBox,
    QListWidget, QListWidgetItem
)
from PySide6.QtCore import Qt, Signal, QTimer
from utils.validation_helpers import ConstraintValidator

PANEL_STYLE = """
QWidget#panel_root { background: #0f172a; }
QGroupBox {
    font-weight: 700; font-size: 11px; color: #94a3b8;
    border: 1px solid rgba(255,255,255,0.08); border-radius: 8px;
    margin-top: 12px; padding: 10px 4px 4px 4px;
}
QGroupBox::title { subcontrol-origin: margin; left: 10px; padding: 0 4px; }
QGroupBox#grp_auto { background: rgba(79, 70, 229, 0.04); border: 1px solid rgba(79, 70, 229, 0.2); }
QPushButton#btn_auto {
    background: qlineargradient(x1:0,y1:0,x2:1,y2:0, stop:0 #4f46e5, stop:1 #7c3aed);
    color: white; font-size: 13px; font-weight: 700; padding: 14px; border-radius: 8px; border: none;
}
QPushButton#btn_auto:hover { background: qlineargradient(x1:0,y1:0,x2:1,y2:0, stop:0 #6366f1, stop:1 #8b5cf6); }
QPushButton#btn_auto:disabled { background: #1e1e2e; color: #475569; }
QPushButton#btn_secondary {
    background: rgba(255,255,255,0.05); color: #94a3b8; font-size: 11px; padding: 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1);
}
QPushButton#btn_secondary:hover { background: rgba(255,255,255,0.1); color: #f1f5f9; }
QLabel#lbl_summary { color: #94a3b8; font-size: 11px; padding: 2px; }
QLabel#lbl_violation_error { color: #f87171; font-size: 11px; font-weight: 600; background: rgba(248, 113, 113, 0.1); padding: 2px 6px; border-radius: 4px; margin-bottom: 2px; }
QLabel#lbl_violation_warn { color: #fbbf24; font-size: 11px; background: rgba(251, 191, 36, 0.1); padding: 2px 6px; border-radius: 4px; margin-bottom: 2px; }
QComboBox { background: #1e293b; color: #f1f5f9; border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; padding: 6px 10px; font-size: 12px; }
QComboBox::drop-down { border: none; }
QScrollArea { border: none; background: transparent; }
"""

PRESET_DESCRIPTIONS = {
    "arret_de_promesse_1": "Niveau 1 \u2014 Très accessible. Texte clair et Morse uniquement.",
    "seconde_classe_1":    "Niveau 2 \u2014 Découverte. Ajout de la carte IGN et du code Gilwell.",
    "premiere_classe_1":  "Niveau 3 \u2014 Confirmé. Utilise un large panel de codes et signaux.",
    "raider_1":            "Niveau 4 \u2014 Orientation. Priorité azimuts et cartes complexes.",
}

class _SummaryWidget(QFrame):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setObjectName("summary_frame")
        self.setStyleSheet("QFrame#summary_frame { background: rgba(79, 70, 229, 0.08); border: 1px solid rgba(79, 70, 229, 0.3); border-radius: 8px; padding: 4px; }")
        self._layout = QVBoxLayout(self)
        self._layout.setContentsMargins(10, 8, 10, 8)
        self._layout.setSpacing(4)
        self._title = QLabel("AUCUN PLAN G\u00C9N\u00C9R\u00C9")
        self._title.setStyleSheet("font-size: 10px; color: #818cf8; font-weight: 800; letter-spacing: 0.5px;")
        self._layout.addWidget(self._title)
        self._body = QLabel("")
        self._body.setObjectName("lbl_summary")
        self._body.setWordWrap(True)
        self._layout.addWidget(self._body)

    def update_summary(self, assignments, segments):
        if not assignments:
            self._title.setText("AUCUN PLAN G\u00C9N\u00C9R\u00C9")
            self._body.setText("Cliquez sur le bouton ci-dessus pour que l'orchestrateur organise votre itin\u00E9raire.")
            return
        counts = {}
        for mod in assignments.values():
            if mod and mod not in ("unassigned", "--- Ignorer ---"): counts[mod] = counts.get(mod, 0) + 1
        if not counts:
            self._title.setText("Assignments vides")
            self._body.setText("")
            return
        n_assigned = sum(counts.values())
        self._title.setText(f"\u2713 PLAN AUTOMATIQUE ({n_assigned}/{len(segments)})")
        self._body.setText(" \u2022 ".join([f"<b>{cnt}\u00D7</b> {mod}" for mod, cnt in sorted(counts.items(), key=lambda x: -x[1])]))

# ────────────────────────────────────────────────────────
# PRESET EDITOR DIALOG
# ────────────────────────────────────────────────────────

class PresetEditorDialog(QDialog):
    def __init__(self, presets_manager, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Éditeur de Présélections")
        self.presets_manager = presets_manager
        self.resize(650, 500)
        self.setStyleSheet("""
            QDialog { background: #0f172a; color: #f1f5f9; }
            QLabel { color: #f1f5f9; }
            QLineEdit, QSpinBox, QListWidget { background: #1e293b; color: #f1f5f9; border: 1px solid rgba(255,255,255,0.2); border-radius: 4px; padding: 4px; }
            QSpinBox::up-button, QSpinBox::down-button { width: 16px; }
            QPushButton { background: rgba(255,255,255,0.1); color: white; border: none; padding: 6px 12px; border-radius: 4px; font-weight: bold; }
            QPushButton:hover { background: rgba(255,255,255,0.2); }
            QPushButton#btn_delete { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
            QPushButton#btn_delete:hover { background: #ef4444; color: white; }
            QPushButton#btn_primary { background: #4f46e5; color: white; }
            QPushButton#btn_primary:hover { background: #6366f1; }
            QListWidget::item { padding: 8px; border-bottom: 1px solid rgba(255,255,255,0.05); }
            QListWidget::item:selected { background: #4f46e5; color: white; border-radius: 4px; }
        """)

        # Data model: we load everything into memory to allow saving/switching
        self.local_custom = {}
        self.local_factory = {}
        
        main_layout = QHBoxLayout(self)
        
        # --- LEFT PANEL (Master) ---
        left_layout = QVBoxLayout()
        self.preset_list = QListWidget()
        self.preset_list.currentRowChanged.connect(self._on_preset_selected)
        left_layout.addWidget(QLabel("<b>Bibliothèque</b>"))
        left_layout.addWidget(self.preset_list)
        
        self.btn_duplicate = QPushButton("➕ Dupliquer")
        self.btn_duplicate.clicked.connect(self._on_duplicate_clicked)
        left_layout.addWidget(self.btn_duplicate)
        
        main_layout.addLayout(left_layout, 1) # stretch 1
        
        # --- RIGHT PANEL (Detail) ---
        right_layout = QVBoxLayout()
        self.detail_grp = QGroupBox("Propriétés de la présélection")
        detail_v = QVBoxLayout(self.detail_grp)
        self.detail_grp.setStyleSheet("QGroupBox { border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding-top: 15px; margin-top: 10px; } "
                                      "QGroupBox::title { subcontrol-origin: margin; left: 10px; }")

        # Name field
        form = QFormLayout()
        self.name_input = QLineEdit()
        self.name_input.textChanged.connect(self._on_name_changed)
        form.addRow("Nom :", self.name_input)
        detail_v.addLayout(form)

        detail_v.addWidget(QLabel("<br><b>Priorité (Poids) des épreuves :</b>"))
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        w_inner = QWidget()
        self.weights_layout = QFormLayout(w_inner)
        self.module_spins = {}
        self.module_labels = {}
        
        self.all_modules = [
            ("Texte Clair", "texte_clair"), ("Morse", "morse"), ("Vigenère", "vigenere"),
            ("Carte IGN", "carte_ign"), ("Gilwell", "gilwell"), ("Drapeaux", "drapeaux"),
            ("Azimut Pur", "azimut_pur"), ("Polybe", "polybe"), ("Templier", "templier"),
            ("Maritime", "maritime"), ("Avocat", "avocat"), ("Cassis", "cassis")
        ]

        for display, mod in self.all_modules:
            hlayout = QHBoxLayout()
            hlayout.setContentsMargins(0, 0, 0, 0)
            
            spin = QSpinBox()
            spin.setRange(0, 9999)
            spin.setSingleStep(5)
            spin.valueChanged.connect(self._on_weight_changed)
            spin.setMinimumWidth(60)
            
            lbl_pct = QLabel("0%")
            lbl_pct.setStyleSheet("color: #94a3b8; font-size: 11px;")
            lbl_pct.setMinimumWidth(45)
            
            hlayout.addWidget(spin)
            hlayout.addWidget(lbl_pct)
            
            self.weights_layout.addRow(display, hlayout)
            self.module_spins[mod] = spin
            self.module_labels[mod] = lbl_pct
        
        scroll.setWidget(w_inner)
        detail_v.addWidget(scroll)
        right_layout.addWidget(self.detail_grp, 3)

        # Bottom Buttons
        bottom_layout = QHBoxLayout()
        self.btn_delete = QPushButton("🗑 Supprimer")
        self.btn_delete.setObjectName("btn_delete")
        self.btn_delete.clicked.connect(self._on_delete_clicked)
        bottom_layout.addWidget(self.btn_delete)
        bottom_layout.addStretch()
        
        self.btn_cancel = QPushButton("Annuler")
        self.btn_cancel.clicked.connect(self.reject)
        bottom_layout.addWidget(self.btn_cancel)
        
        self.btn_save = QPushButton("✅ Enregistrer et Fermer")
        self.btn_save.setObjectName("btn_primary")
        self.btn_save.clicked.connect(self._on_save_clicked)
        bottom_layout.addWidget(self.btn_save)
        
        right_layout.addLayout(bottom_layout)
        main_layout.addLayout(right_layout, 2) # stretch 2

        self._load_data()

    def _load_data(self):
        # Read from manager
        import copy
        self.local_factory = copy.deepcopy(self.presets_manager.presets_data.get("factory", {}))
        self.local_custom = copy.deepcopy(self.presets_manager.presets_data.get("custom", {}))
        self._rebuild_list()
        
        # Select currently active
        pid = self.presets_manager.active_preset_id
        if pid:
            self._select_preset_id(pid)
        elif self.preset_list.count() > 0:
            self.preset_list.setCurrentRow(0)

    def _rebuild_list(self):
        self.preset_list.blockSignals(True)
        self.preset_list.clear()
        
        # Add factory
        for pid, data in self.local_factory.items():
            item = QListWidgetItem(f"🔒 {data.get('name', 'Usine')}")
            item.setData(Qt.UserRole, ("factory", pid))
            self.preset_list.addItem(item)
            
        # Add custom
        for pid, data in self.local_custom.items():
            item = QListWidgetItem(f"★ {data.get('name', 'Custom')}")
            item.setData(Qt.UserRole, ("custom", pid))
            self.preset_list.addItem(item)
            
        self.preset_list.blockSignals(False)

    def _select_preset_id(self, pid):
        for i in range(self.preset_list.count()):
            item = self.preset_list.item(i)
            if item.data(Qt.UserRole)[1] == pid:
                self.preset_list.setCurrentRow(i)
                return

    def _get_current_data(self):
        item = self.preset_list.currentItem()
        if not item: return None, None, None
        ptype, pid = item.data(Qt.UserRole)
        data = self.local_factory.get(pid) if ptype == "factory" else self.local_custom.get(pid)
        return ptype, pid, data

    def _on_preset_selected(self, row):
        ptype, pid, data = self._get_current_data()
        if not data:
            self.detail_grp.setEnabled(False)
            return
            
        self.detail_grp.setEnabled(True)
        
        # Block signals to prevent overwrite
        self.name_input.blockSignals(True)
        for spin in self.module_spins.values():
            spin.blockSignals(True)
            
        # Name
        self.name_input.setText(data.get("name", "Sans nom"))
        self.name_input.setReadOnly(ptype == "factory")
        self.name_input.setStyleSheet("color: #94a3b8;" if ptype=="factory" else "color: white;")
        
        # Delete btn
        self.btn_delete.setVisible(ptype == "custom")
        
        # Weights
        weights = data.get("weights", {})
        for _, mod in self.all_modules:
            val = weights.get(mod, 0)
            self.module_spins[mod].setValue(val)
            self.module_spins[mod].setEnabled(ptype == "custom")

        self.name_input.blockSignals(False)
        for spin in self.module_spins.values():
            spin.blockSignals(False)
            
        self._update_percentages()

    def _on_weight_changed(self):
        self._update_percentages()
        ptype, pid, data = self._get_current_data()
        if ptype == "custom" and data:
            if "weights" not in data: data["weights"] = {}
            for mod, spin in self.module_spins.items():
                data["weights"][mod] = spin.value()

    def _update_percentages(self):
        total = sum(spin.value() for spin in self.module_spins.values())
        for mod, spin in self.module_spins.items():
            pct = (spin.value() / total * 100) if total > 0 else 0.0
            self.module_labels[mod].setText(f"{pct:.1f}%")

    def _on_name_changed(self, text):
        ptype, pid, data = self._get_current_data()
        if ptype != "custom": return
        data["name"] = text
        # Update list display immediately
        item = self.preset_list.currentItem()
        if item:
            item.setText(f"★ {text}")

    def _on_duplicate_clicked(self):
        _, _, data = self._get_current_data()
        if not data: return
        import copy, time
        new_data = copy.deepcopy(data)
        new_data["name"] = new_data.get("name", "Copie") + " (Copie)"
        new_id = f"custom_{int(time.time()*100)}"
        
        self.local_custom[new_id] = new_data
        self._rebuild_list()
        self._select_preset_id(new_id)

    def _on_delete_clicked(self):
        ptype, pid, _ = self._get_current_data()
        if ptype != "custom": return
        rep = QMessageBox.question(self, "Supprimer", "Voulez-vous supprimer cette présélection personnalisée ?")
        if rep == QMessageBox.Yes:
            del self.local_custom[pid]
            self._rebuild_list()
            if self.preset_list.count() > 0:
                self.preset_list.setCurrentRow(0)

    def _on_save_clicked(self):
        # 1. Clear manager's custom list
        self.presets_manager.presets_data["custom"] = {}
        # 2. Add all local_custom items back
        for pid, d in self.local_custom.items():
            self.presets_manager.save_custom_preset(pid, d)
        
        # 3. Handle active selection change if current was deleted
        _, current_id, _ = self._get_current_data()
        if current_id:
            self.presets_manager.set_active_preset(current_id)
        
        self.presets_manager.save()
        self.accept()

# ────────────────────────────────────────────────────────

class DifficultyPanel(QWidget):
    assignment_changed = Signal()
    trigger_export = Signal()

    def __init__(self, state_manager, presets_manager):
        super().__init__()
        self.setObjectName("panel_root")
        self.state_manager = state_manager
        self.presets_manager = presets_manager
        self._validator = ConstraintValidator()
        self._validate_timer = QTimer()
        self._validate_timer.setSingleShot(True)
        self._validate_timer.setInterval(700)
        self._validate_timer.timeout.connect(self._run_validation)

        self.setStyleSheet(PANEL_STYLE)
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        inner = QWidget()
        layout = QVBoxLayout(inner)
        layout.setContentsMargins(10, 8, 10, 8)
        layout.setSpacing(12)

        grp_rules = QGroupBox("STRAT\u00C9GIE DE L'ORCHESTRATEUR")
        rules_layout = QVBoxLayout(grp_rules)
        txt = "\u2022 <b>Rythme :</b> Max 3 \u00E9crits d'affil\u00E9e.<br>\u2022 <b>Visibilit\u00E9 :</b> Alternance visuel/\u00E9crit.<br>\u2022 <b>POI :</b> Texte clair forc\u00E9 en ville.<br>\u2022 <b>Exhaustivit\u00E9 :</b> Tout module activ\u00E9 utilis\u00E9 1\u00D7."
        rules_lbl = QLabel(txt); rules_lbl.setWordWrap(True); rules_lbl.setStyleSheet("font-size: 11px; color: #64748b;")
        rules_layout.addWidget(rules_lbl); layout.addWidget(grp_rules)

        grp_auto = QGroupBox("MODE AUTOMATIQUE (RECOMMAND\u00C9)")
        grp_auto.setObjectName("grp_auto")
        auto_layout = QVBoxLayout(grp_auto)
        row_p = QHBoxLayout()
        row_p.addWidget(QLabel("Niveau :"))
        self.combo_presets = QComboBox()
        self.combo_presets.currentIndexChanged.connect(self._on_preset_changed)
        row_p.addWidget(self.combo_presets, 1)

        self.btn_edit_preset = QPushButton("⚙")
        self.btn_edit_preset.setToolTip("Editer le preset")
        self.btn_edit_preset.setObjectName("btn_secondary")
        self.btn_edit_preset.setFixedSize(28, 28)
        self.btn_edit_preset.clicked.connect(self._open_preset_editor)
        row_p.addWidget(self.btn_edit_preset)

        auto_layout.addLayout(row_p)
        self.lbl_preset_desc = QLabel(""); self.lbl_preset_desc.setWordWrap(True); self.lbl_preset_desc.setStyleSheet("font-size: 11px; color: #818cf8; italic;")
        auto_layout.addWidget(self.lbl_preset_desc)
        self.btn_auto = QPushButton("\u26A1  Organiser l'itin\u00E9raire")
        self.btn_auto.setObjectName("btn_auto"); self.btn_auto.setCursor(Qt.PointingHandCursor); self.btn_auto.clicked.connect(self._run_orchestrator)
        auto_layout.addWidget(self.btn_auto)
        self._summary = _SummaryWidget(); auto_layout.addWidget(self._summary); layout.addWidget(grp_auto)

        grp_manual = QGroupBox("VALIDATEUR DE CONTRAINTES")
        manual_layout = QVBoxLayout(grp_manual)
        self._lbl_no_violations = QLabel("\u2713 Contraintes respect\u00E9es")
        self._lbl_no_violations.setStyleSheet("font-size: 11px; color: #22c55e; font-weight: 600;"); self._lbl_no_violations.setVisible(False)
        manual_layout.addWidget(self._lbl_no_violations)
        self._violations_area = QVBoxLayout(); self._violations_area.setSpacing(4); manual_layout.addLayout(self._violations_area); layout.addWidget(grp_manual)

        self.btn_export = QPushButton("\u1F4C4  G\u00E9n\u00E9rer les carnets PDF")
        self.btn_export.setObjectName("btn_secondary"); self.btn_export.setCursor(Qt.PointingHandCursor); self.btn_export.clicked.connect(self.trigger_export)
        layout.addWidget(self.btn_export); layout.addStretch()

        scroll.setWidget(inner); main_vbox = QVBoxLayout(self); main_vbox.setContentsMargins(0,0,0,0); main_vbox.addWidget(scroll)
        self.load_presets(); self.state_manager.state_changed.connect(self._on_state_changed)

    def load_presets(self):
        self.combo_presets.clear()
        for pid, pdata in self.presets_manager.presets_data.get("factory", {}).items(): self.combo_presets.addItem(pdata.get("name", pid), userData=pid)
        for pid, pdata in self.presets_manager.presets_data.get("custom", {}).items(): self.combo_presets.addItem(f"\u2605 {pdata.get('name', pid)}", userData=pid)
        self._on_preset_changed()

    def _on_preset_changed(self):
        pid = self.combo_presets.currentData()
        self.lbl_preset_desc.setText(PRESET_DESCRIPTIONS.get(pid, ""))
        self.state_manager.update_state("active_preset_id", pid)
        self.presets_manager.set_active_preset(pid)

    def _open_preset_editor(self):
        diag = PresetEditorDialog(self.presets_manager, self)
        if diag.exec() == QDialog.Accepted:
            self.load_presets()
            pid = self.presets_manager.active_preset_id
            idx = self.combo_presets.findData(pid)
            if idx >= 0:
                self.combo_presets.setCurrentIndex(idx)
                    
    def _on_state_changed(self, key, _value):
        if key in ("custom_assignments", "polygonal_steps"): self._validate_timer.start()

    def _run_orchestrator(self):
        steps = self.state_manager.get_state("polygonal_steps", [])
        if not steps:
            QMessageBox.warning(self, "Segmentation requise", "Calculez d'abord les segments dans l'onglet Segmentation.")
            return
        self.btn_auto.setEnabled(False); self.btn_auto.setText("\u26A1  Orchestration en cours\u2026")
        pid = self.combo_presets.currentData()
        self.state_manager.update_state("active_preset_id", pid)
        self.state_manager.update_state("distribution_mode", "auto")
        self.presets_manager.set_active_preset(pid)
        from main_orchestrator import Orchestrator
        try:
            Orchestrator(self.state_manager).calculate_assignments_from_gui()
            self._summary.update_summary(self.state_manager.get_state("custom_assignments", {}), steps)
            self._run_validation(); self.assignment_changed.emit()
        except Exception as e: QMessageBox.critical(self, "Erreur Orchestrateur", str(e))
        finally: self.btn_auto.setEnabled(True); self.btn_auto.setText("\u26A1  Organiser l'itin\u00E9raire")

    def _run_validation(self):
        segments = self.state_manager.get_state("polygonal_steps", [])
        assignments = self.state_manager.get_state("custom_assignments", {})
        violations = self._validator.validate(segments, assignments, self.presets_manager)
        while self._violations_area.count():
            w = self._violations_area.takeAt(0).widget()
            if w: w.deleteLater()
        if not violations: self._lbl_no_violations.setVisible(True) if assignments else self._lbl_no_violations.setVisible(False)
        else:
            self._lbl_no_violations.setVisible(False)
            for v in violations[:10]:
                lbl = QLabel(v["message"]); lbl.setObjectName("lbl_violation_error" if v["level"] == "error" else "lbl_violation_warn"); lbl.setWordWrap(True)
                self._violations_area.addWidget(lbl)

    def refresh_from_state(self):
        pid = self.state_manager.get_state("active_preset_id")
        if pid:
            idx = self.combo_presets.findData(pid)
            if idx >= 0: self.combo_presets.setCurrentIndex(idx)
        self._summary.update_summary(self.state_manager.get_state("custom_assignments", {}), self.state_manager.get_state("polygonal_steps", []))
        self._run_validation()
