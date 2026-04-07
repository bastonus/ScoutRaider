import os
import json

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from PySide6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QLabel, 
                               QPushButton, QComboBox, QGroupBox, QScrollArea, QMessageBox)
from PySide6.QtCore import Qt, Signal

class InspectorPanel(QWidget):
    """Right-side panel: Segment inspector, theme, and export."""
    assignment_changed = Signal()
    trigger_export = Signal()

    def __init__(self, state_manager):
        super().__init__()
        self.state_manager = state_manager
        self.current_seg_idx = -1
        
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        
        inner = QWidget()
        layout = QVBoxLayout(inner)
        layout.setContentsMargins(8, 4, 8, 4)
        layout.setSpacing(2)
        
        # ── SECTION: SEGMENT DETAILS ──────────────────────────
        self.group_inspector = QGroupBox("SEGMENT DETAILS")
        insp_layout = QVBoxLayout()
        insp_layout.setSpacing(4)
        
        self.lbl_seg_info = QLabel("Click a segment on the map to inspect it")
        self.lbl_seg_info.setWordWrap(True)
        
        self.lbl_seg_info_2 = QLabel("")
        
        insp_layout.addWidget(self.lbl_seg_info)
        insp_layout.addWidget(self.lbl_seg_info_2)
        
        mod_row = QHBoxLayout()
        mod_lbl = QLabel("Challenge")
        mod_lbl.setToolTip("The type of module assigned to this segment")
        mod_row.addWidget(mod_lbl)
        self.combo_module = QComboBox()
        self.combo_module.addItem("Auto")
        self.combo_module.addItems(self.get_available_modules())
        self.combo_module.setEnabled(False)
        self.combo_module.currentIndexChanged.connect(self.on_combo_changed)
        mod_row.addWidget(self.combo_module, 1)
        insp_layout.addLayout(mod_row)
        
        self.group_inspector.setLayout(insp_layout)
        layout.addWidget(self.group_inspector)
        
        # ── SECTION: THEME ──────────────────────────
        group_theme = QGroupBox("DOCUMENT STYLE")
        theme_layout = QVBoxLayout()
        theme_layout.setSpacing(4)
        
        theme_row = QHBoxLayout()
        theme_lbl = QLabel("Theme")
        theme_lbl.setToolTip("Visual theme applied to the exported PDF booklet")
        theme_row.addWidget(theme_lbl)
        self.combo_theme = QComboBox()
        self.combo_theme.addItems(["Neutre", "Carnet_Contrebandier", "Aventures_Maritimes"])
        self.combo_theme.currentTextChanged.connect(lambda t: self.state_manager.update_state("theme_id", t))
        theme_row.addWidget(self.combo_theme, 1)
        theme_layout.addLayout(theme_row)
        
        group_theme.setLayout(theme_layout)
        layout.addWidget(group_theme)
        
        layout.addStretch()
        
        # ── EXPORT ──────────────────────────
        self.btn_export = QPushButton("Export to PDF")
        self.btn_export.setObjectName("exportButton")
        self.btn_export.setToolTip("Generate the participant and solution PDF booklets")
        self.btn_export.clicked.connect(self.trigger_export.emit)
        layout.addWidget(self.btn_export)
        
        scroll.setWidget(inner)
        outer = QVBoxLayout(self)
        outer.setContentsMargins(0, 0, 0, 0)
        outer.addWidget(scroll)

    def get_available_modules(self):
        reg_path = os.path.join(PROJECT_ROOT, "config", "modules_registry.json")
        if os.path.exists(reg_path):
            with open(reg_path, 'r', encoding='utf-8') as f:
                return json.load(f).get("installed", [])
        modules_dir = os.path.join(PROJECT_ROOT, "modules")
        if os.path.exists(modules_dir):
            return [d for d in os.listdir(modules_dir) if os.path.isdir(os.path.join(modules_dir, d))]
        return []

    def set_selected_segment(self, idx):
        self.current_seg_idx = idx
        steps = self.state_manager.get_state("polygonal_steps", [])
        if idx < 0 or idx >= len(steps):
            self.lbl_seg_info.setText("Click a segment on the map to inspect it")
            self.lbl_seg_info_2.setText("")
            self.combo_module.setEnabled(False)
            self.combo_module.setCurrentIndex(0)
            return
            
        seg = steps[idx]
        dist = seg.get('distance', '?')
        azi = seg.get('azimut', '?')
        
        self.lbl_seg_info.setText(f"Segment #{idx+1}")
        self.lbl_seg_info_2.setText(f"{dist} m  |  {azi} deg")
        
        assigns = self.state_manager.get_state("custom_assignments", {})
        mod = assigns.get(str(idx), None)
        
        self.combo_module.blockSignals(True)
        self.combo_module.setEnabled(True)
        if mod:
            cidx = self.combo_module.findText(mod)
            if cidx >= 0: self.combo_module.setCurrentIndex(cidx)
        else:
            self.combo_module.setCurrentIndex(0)
        self.combo_module.blockSignals(False)

    def on_combo_changed(self, idx):
        if self.current_seg_idx < 0: return
        
        assigns = self.state_manager.get_state("custom_assignments", {})
        txt = self.combo_module.currentText()
        if txt == "Auto":
            if str(self.current_seg_idx) in assigns:
                del assigns[str(self.current_seg_idx)]
        else:
            assigns[str(self.current_seg_idx)] = txt
            
        self.state_manager.update_state("custom_assignments", assigns)
        self.assignment_changed.emit()

    def refresh_from_state(self):
        theme_id = self.state_manager.get_state("theme_id", "Neutre")
        idx = self.combo_theme.findText(theme_id)
        if idx >= 0:
            self.combo_theme.setCurrentIndex(idx)
        self.set_selected_segment(-1)
