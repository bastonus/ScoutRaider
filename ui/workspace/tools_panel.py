"""
Segmentation Panel — Controls for splitting routes into directional segments.
(Formerly tools_panel.py — import section moved to route_panel.py)
"""
import os
import sys
import json
import csv
import math

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, PROJECT_ROOT)

from PySide6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QLabel,
                               QPushButton, QGroupBox, QSlider, QCheckBox, QScrollArea,
                               QFileDialog, QMessageBox, QTabWidget, QComboBox)
from PySide6.QtCore import Qt, Signal, QThread

class ToolsPanel(QWidget):
    """Segmentation controls — curve sensitivity, min length, options."""
    map_needs_update = Signal()
    polygonalization_finished = Signal()
    manual_recalc_requested = Signal()
    poly_recalc_started = Signal(list) # Emitted with old assignments metadata
    
    analysis_cache = {"points": [], "indices": [], "instr_count": 0}

    def __init__(self, state_manager):
        super().__init__()
        self.state_manager = state_manager
        
        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setHorizontalScrollBarPolicy(Qt.ScrollBarAlwaysOff)
        
        inner = QWidget()
        layout = QVBoxLayout(inner)
        layout.setContentsMargins(8, 4, 8, 4)
        layout.setSpacing(2)

        # ── SEGMENTATION CONTROLS ──────────────────────────
        group_poly = QGroupBox("PR\u00C9PARATION DES SEGMENTS")
        poly_layout = QVBoxLayout()
        poly_layout.setSpacing(4)
        
        desc_poly = QLabel("D\u00E9coupez votre itin\u00E9raire en segments directionnels pr\u00EAts \u00E0 \u00EAtre encod\u00E9s.")
        desc_poly.setStyleSheet("color: #94a3b8; font-size: 11px; font-style: italic; margin-bottom: 4px;")
        desc_poly.setWordWrap(True)
        poly_layout.addWidget(desc_poly)
        
        # Tolérance
        tol_row = QHBoxLayout()
        tol_lbl = QLabel("Sensibilité virage")
        tol_lbl.setToolTip("Plus haut = plus de segments aux virages, Plus bas = tracés plus droits")
        tol_row.addWidget(tol_lbl)
        self.slider_tol = QSlider(Qt.Horizontal)
        self.slider_tol.setRange(0, 90)
        self.slider_tol.setValue(45)
        self.slider_tol.valueChanged.connect(self.cb_tol_changed)
        tol_row.addWidget(self.slider_tol, 1)
        self.lbl_tol = QLabel("45")
        self.lbl_tol.setFixedWidth(24)
        tol_row.addWidget(self.lbl_tol)
        poly_layout.addLayout(tol_row)
        
        # Min distance
        dist_row = QHBoxLayout()
        dist_lbl = QLabel("Long. min (m)")
        dist_lbl.setToolTip("Distance minimale en mètres par segment")
        dist_row.addWidget(dist_lbl)
        self.slider_mindist = QSlider(Qt.Horizontal)
        self.slider_mindist.setRange(0, 300)
        self.slider_mindist.setValue(80)
        self.slider_mindist.valueChanged.connect(self.on_slider_move)
        dist_row.addWidget(self.slider_mindist, 1)
        self.lbl_mindist = QLabel("80")
        self.lbl_mindist.setFixedWidth(24)
        dist_row.addWidget(self.lbl_mindist)
        poly_layout.addLayout(dist_row)

        # Options
        self.chk_hors_piste = QCheckBox("Mode ligne droite")
        self.chk_hors_piste.setToolTip("Ignorer les routes, tracer des lignes directes entre les points")
        self.chk_intersections = QCheckBox("Couper aux carrefours")
        self.chk_intersections.setToolTip("Créer automatiquement un nouveau segment à chaque intersection")
        self.chk_intersections.setChecked(True)
        opts = QHBoxLayout()
        opts.addWidget(self.chk_hors_piste)
        opts.addWidget(self.chk_intersections)
        poly_layout.addLayout(opts)
        
        self.chk_arrows = QCheckBox("Afficher les flèches de direction")
        self.chk_arrows.setToolTip("Afficher les flèches d'azimut rouges sur chaque segment")
        self.chk_arrows.setChecked(True)
        self.chk_arrows.stateChanged.connect(self.on_arrows_toggled)
        poly_layout.addWidget(self.chk_arrows)
        
        self.btn_run_poly = QPushButton("Recalculer les segments")
        self.btn_run_poly.setToolTip("Découper l'itinéraire en segments selon les paramètres actuels")
        self.btn_run_poly.clicked.connect(self.run_polygonalization)
        poly_layout.addWidget(self.btn_run_poly)
        
        group_poly.setLayout(poly_layout)
        layout.addWidget(group_poly)

        layout.addStretch()

        scroll.setWidget(inner)
        outer = QVBoxLayout(self)
        outer.setContentsMargins(0, 0, 0, 0)
        outer.addWidget(scroll)

    def set_state_manager(self, state_manager):
        """Rebind this panel to a different StateManager (multi-tab support)."""
        self.state_manager = state_manager
        self.refresh_from_state()

    # ── Callbacks ──────────────────────────

    def cb_tol_changed(self, val):
        self.lbl_tol.setText(str(val))
        self.on_slider_move()

    def on_slider_move(self):
        self.lbl_mindist.setText(str(self.slider_mindist.value()))
        self.run_fast_polygonalization()

    def run_polygonalization_async(self):
        pass

    def _on_analysis_done(self, pts, indices, count):
        self.analysis_cache = {"points": pts, "indices": indices, "instr_count": count}
        self.run_fast_polygonalization()

    def run_polygonalization(self):
        # Triggered by UI button "Recalculer les segments"
        self.manual_recalc_requested.emit()

    def run_fast_polygonalization(self):
        pts = self.analysis_cache.get("points")
        if not pts: return
        
        import refactor_polygonalisation
        settings = {
            "tolerance": self.slider_tol.value(),
            "allow_offroad": self.chk_hors_piste.isChecked(),
            "force_intersections": self.chk_intersections.isChecked(),
            "min_dist": self.slider_mindist.value()
        }
        self.state_manager.update_state("polygonalization_settings", settings)
        
        masked = self.state_manager.get_state("masked_nodes", [])
        forced = self.state_manager.get_state("forced_nodes", [])
        
        processed_features = refactor_polygonalisation.solve_polygonalisation(
            pts, 
            self.analysis_cache["indices"],
            settings["tolerance"],
            settings["min_dist"],
            settings["allow_offroad"],
            settings["force_intersections"],
            masked,
            forced
        )
        
        segments = []
        for feat in processed_features:
            p = feat.get('properties', {})
            geom = feat.get('geometry', {})
            segments.append({
                'azimut': p.get('azimut', 0),
                'distance': p.get('metrage', 0),
                'coords': geom.get('coordinates', []),
                'properties': p
            })
        
        self.state_manager.update_state("polygonal_steps", segments)
        self.polygonalization_finished.emit()
        self.map_needs_update.emit()

    def on_arrows_toggled(self, state):
        show = (state == Qt.Checked.value or state == Qt.Checked)
        self.state_manager.update_state("show_azimuth_arrows", show)
        self.polygonalization_finished.emit()

    def refresh_from_state(self):
        poly_settings = self.state_manager.get_state("polygonalization_settings", {})
        self.slider_tol.setValue(poly_settings.get("tolerance", 45))
        self.chk_hors_piste.setChecked(poly_settings.get("allow_offroad", False))
        self.chk_intersections.setChecked(poly_settings.get("force_intersections", True))
        self.slider_mindist.setValue(poly_settings.get("min_dist", 80))

        show_arrows = self.state_manager.get_state("show_azimuth_arrows", True)
        self.chk_arrows.setChecked(show_arrows)
