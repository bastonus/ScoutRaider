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
                               QFileDialog, QMessageBox)
from PySide6.QtCore import Qt, Signal, QThread

class ToolsPanel(QWidget):
    """Segmentation controls — curve sensitivity, min length, options."""
    map_needs_update = Signal()
    poly_needs_update = Signal()
    manual_recalc_requested = Signal()
    
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
        group_poly = QGroupBox("SEGMENTATION")
        poly_layout = QVBoxLayout()
        poly_layout.setSpacing(4)
        
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

        # ── EXPORT ─────────────────────────────────────────
        group_export = QGroupBox("EXPORT")
        export_layout = QVBoxLayout()
        export_layout.setSpacing(4)

        self.btn_export_csv = QPushButton("⬇ Exporter les nœuds (CSV)")
        self.btn_export_csv.setToolTip(
            "Exporter la liste des nœuds avec coordonnées GPS, azimut, métrage, technique et tronçon")
        self.btn_export_csv.clicked.connect(self._export_csv)
        export_layout.addWidget(self.btn_export_csv)

        group_export.setLayout(export_layout)
        layout.addWidget(group_export)

        layout.addStretch()

        scroll.setWidget(inner)
        outer = QVBoxLayout(self)
        outer.setContentsMargins(0, 0, 0, 0)
        outer.addWidget(scroll)

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
        self.poly_needs_update.emit()
        self.map_needs_update.emit()

    def on_arrows_toggled(self, state):
        show = (state == Qt.Checked.value or state == Qt.Checked)
        self.state_manager.update_state("show_azimuth_arrows", show)
        self.poly_needs_update.emit()

    def refresh_from_state(self):
        poly_settings = self.state_manager.get_state("polygonalization_settings", {})
        self.slider_tol.setValue(poly_settings.get("tolerance", 45))
        self.chk_hors_piste.setChecked(poly_settings.get("allow_offroad", False))
        self.chk_intersections.setChecked(poly_settings.get("force_intersections", True))
        self.slider_mindist.setValue(poly_settings.get("min_dist", 80))

        show_arrows = self.state_manager.get_state("show_azimuth_arrows", True)
        self.chk_arrows.setChecked(show_arrows)

    # ── CSV Export ─────────────────────────────────────────

    def _export_csv(self):
        """Export polygonal nodes as CSV with GPS coords, azimuth, distance, technique, tronçon label."""
        steps = self.state_manager.get_state("polygonal_steps", [])
        if not steps:
            QMessageBox.warning(self, "Export CSV",
                "Aucun segment disponible.\nLancez d'abord la segmentation (\"Recalculer les segments\").")
            return

        filepath, _ = QFileDialog.getSaveFileName(
            self, "Exporter les nœuds en CSV",
            "noeuds_itineraire.csv",
            "Fichier CSV (*.csv);;Tous les fichiers (*.*)")
        if not filepath:
            return

        # ── Data sources ──────────────────────────────────
        manual_assigns = self.state_manager.get_state("custom_assignments", {})
        auto_assigns   = self.state_manager.get_state("auto_assignments", {})
        stages         = self.state_manager.get_state("stages", [])  # [{lat, lon, label}]

        # ── Build tronçon boundaries ──────────────────────
        # For each segment, determine which tronçon (A→B, B→C…) it belongs to.
        # Strategy: find the closest waypoint (stage) to each segment's start node,
        # then assign tronçon based on the previous and next stage labels.
        def _haversine_m(lat1, lon1, lat2, lon2):
            R = 6371000
            phi1, phi2 = math.radians(lat1), math.radians(lat2)
            dphi = math.radians(lat2 - lat1)
            dlam = math.radians(lon2 - lon1)
            a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlam/2)**2
            return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

        # stages sorted by their natural label order (A, B, C…)
        sorted_stages = sorted(stages, key=lambda s: s.get("label", ""))

        # For each stage, find the segment index whose start node is closest to that stage
        stage_seg_indices = []  # parallel to sorted_stages
        for stage in sorted_stages:
            slat, slon = stage["lat"], stage["lon"]
            best_idx, best_d = 0, float("inf")
            for i, seg in enumerate(steps):
                coords = seg.get("coords", [])
                if not coords:
                    coords = seg.get("properties", {}).get("coords_intersection", None)
                    if coords:
                        node_lon, node_lat = coords[0], coords[1]
                    else:
                        continue
                else:
                    node_lon, node_lat = coords[0][0], coords[0][1]
                d = _haversine_m(slat, slon, node_lat, node_lon)
                if d < best_d:
                    best_d, best_idx = d, i
            stage_seg_indices.append(best_idx)

        def _troncon_label(seg_idx):
            """Return label like 'A→B' for the given segment index."""
            if not sorted_stages or len(sorted_stages) < 2:
                return ""
            # Find between which two consecutive stages this segment sits
            for k in range(len(stage_seg_indices) - 1):
                lo = stage_seg_indices[k]
                hi = stage_seg_indices[k + 1]
                # Normalise in case stages aren't perfectly ordered by seg index
                if lo > hi:
                    lo, hi = hi, lo
                if lo <= seg_idx <= hi:
                    lbl_a = sorted_stages[k].get("label", str(k))
                    lbl_b = sorted_stages[k + 1].get("label", str(k + 1))
                    return f"{lbl_a}\u2192{lbl_b}"
            # Fallback: before first stage or after last
            if seg_idx < stage_seg_indices[0]:
                return f"?\u2192{sorted_stages[0].get('label', 'A')}"
            return f"{sorted_stages[-1].get('label', '?')}\u2192?"

        # ── Write CSV ─────────────────────────────────────
        try:
            with open(filepath, 'w', newline='', encoding='utf-8-sig') as f:
                writer = csv.writer(f, delimiter=';')
                writer.writerow([
                    "N°", "Latitude", "Longitude",
                    "Azimut (°)", "Métrage (m)",
                    "Technique", "Tronçon"
                ])
                for i, seg in enumerate(steps):
                    props    = seg.get("properties", {})
                    coords   = seg.get("coords", [])
                    azimut   = seg.get("azimut",   props.get("azimut",  ""))
                    metrage  = seg.get("distance",  props.get("metrage", ""))

                    # Start-node GPS
                    if coords:
                        node_lon, node_lat = coords[0][0], coords[0][1]
                    else:
                        ci = props.get("coords_intersection")
                        if ci:
                            node_lon, node_lat = ci[0], ci[1]
                        else:
                            node_lat = node_lon = ""

                    # Technique: manual override → auto assignment → blank
                    technique = (manual_assigns.get(str(i))
                                 or auto_assigns.get(str(i))
                                 or "")

                    troncon = _troncon_label(i)

                    # Format coords to 6 decimal places
                    lat_str = f"{node_lat:.6f}".replace('.', ',') if isinstance(node_lat, float) else node_lat
                    lon_str = f"{node_lon:.6f}".replace('.', ',') if isinstance(node_lon, float) else node_lon

                    writer.writerow([
                        i + 1, lat_str, lon_str,
                        azimut, metrage,
                        technique, troncon
                    ])

            QMessageBox.information(self, "Export CSV",
                f"✓ {len(steps)} nœuds exportés avec succès !\n{filepath}")
        except Exception as e:
            QMessageBox.critical(self, "Erreur export CSV", str(e))
