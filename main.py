"""
ScoutRaider Suite — Main Application Window
4-dock Photoshop-style workspace with multi-route engine.
"""
import os
import sys
import json
import logging
import math
from concurrent.futures import ThreadPoolExecutor, as_completed
from PySide6.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, 
                                QHBoxLayout, QLabel, QProgressDialog, QDockWidget, 
                                QStatusBar, QMessageBox, QFileDialog, QInputDialog, 
                                QTabWidget, QTabBar, QRubberBand, QDialog, 
                                QPushButton, QListWidget, QListWidgetItem, 
                                QTextEdit, QProgressBar, QPlainTextEdit)
from PySide6.QtCore import Qt, QTimer, QThread, QSettings, QByteArray, QMutex
from PySide6.QtGui import QAction, QActionGroup, QIcon

# Ensure project root is in path
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from state_manager import StateManager
from utils.presets_manager import PresetsManager
from utils.ign_client import IGNClient
from utils.validation_helpers import ConstraintValidator
from utils.auto_updater import UpdateCheckerThread
import refactor_polygonalisation

from ui.workspace.tools_panel import ToolsPanel
from ui.workspace.map_view import MapView
from ui.workspace.route_panel import RoutePanel
from ui.workspace.library_dock import LibraryDock
from ui.workspace.difficulty_panel import DifficultyPanel

from PySide6.QtCore import Signal as _Signal


# ═══════════════════════════════════════════════════════
#  SPATIAL GRID — O(1) overlap detection (replaces O(n²))
# ═══════════════════════════════════════════════════════

class _SpatialGrid:
    """Fast spatial proximity checker using a grid hash.
    Converts O(n*m) point-to-point comparisons into O(n) lookups.
    """
    def __init__(self, cell_size=0.0003):
        self._grid = {}
        self._cell = cell_size

    def _key(self, x, y):
        return (int(x / self._cell), int(y / self._cell))

    def insert_points(self, coords):
        """Insert a list of [lon, lat] points into the grid."""
        for p in coords:
            k = self._key(p[0], p[1])
            self._grid[k] = True

    def count_nearby(self, coords):
        """Count how many points in `coords` are within one cell of any inserted point."""
        count = 0
        for p in coords:
            cx, cy = self._key(p[0], p[1])
            # Check the cell and its 8 neighbours
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    if (cx + dx, cy + dy) in self._grid:
                        count += 1
                        break
                else:
                    continue
                break
        return count


# ═══════════════════════════════════════════════════════
#  ROUTE CALCULATION WORKER  (non-blocking QThread)
# ═══════════════════════════════════════════════════════

class _RouteCalculationWorker(QThread):
    """Calculates all route legs in parallel using ThreadPoolExecutor.
    Emits results when done so the UI thread can process them."""
    route_calculated = _Signal(list, list, list)  # stages, leg_routes (name, key, geom), all_coords
    progress_update  = _Signal(str)               # status message
    calculation_error = _Signal(str)              # error message

    def __init__(self, stages, ign_client, leg_choices, small_roads_only=False):
        super().__init__()
        self._stages = stages
        self._ign_client = ign_client
        self._leg_choices = leg_choices
        self._small_roads_only = small_roads_only
        self._cancelled = False

    def cancel(self):
        self._cancelled = True
        self.requestInterruption()

    def _compute_single_leg(self, i, s1, s2):
        """Compute one leg — designed to run in a thread pool thread."""
        if self._cancelled:
            return None

        p1 = [s1["lat"], s1["lon"]]
        p2 = [s2["lat"], s2["lon"]]
        leg_key = f"{round(p1[0],6)}_{round(p1[1],6)}_{round(p2[0],6)}_{round(p2[1],6)}"

        # Check cached choice first
        if leg_key in self._leg_choices:
            return (i, leg_key, self._leg_choices[leg_key], None)

        alts = self._ign_client.compute_route_alternatives(
            p1, p2, "pedestrian", max_alts=1,
            small_roads_only=self._small_roads_only
        )

        if not alts:
            # Straight-line fallback
            coords = [[p1[1], p1[0]], [p2[1], p2[0]]]
            return (i, leg_key, coords, None)

        best_coords = alts[0]["geometry"].get("coordinates", [])
        is_fallback = alts[0].get("is_fallback", False)
        danger_level = alts[0].get("danger_level", None)
        return (i, leg_key, best_coords, alts, is_fallback, danger_level)

    def run(self):
        try:
            stages = self._stages
            if len(stages) < 2:
                self.calculation_error.emit("Pas assez d'étapes")
                return

            leg_results = [None] * (len(stages) - 1)
            all_alts = [None] * (len(stages) - 1)  # Store alternatives for overlap check

            # Parallel computation of all legs
            max_workers = min(4, len(stages) - 1)
            with ThreadPoolExecutor(max_workers=max_workers) as pool:
                futures = {}
                for i in range(len(stages) - 1):
                    s1, s2 = stages[i], stages[i + 1]
                    if (s1.get("lat") is None or s1.get("lon") is None or
                            s2.get("lat") is None or s2.get("lon") is None):
                        continue

                    fut = pool.submit(self._compute_single_leg, i, s1, s2)
                    futures[fut] = i

                completed = 0
                total = len(futures)
                for fut in as_completed(futures):
                    if self._cancelled:
                        return
                    result = fut.result()
                    if result is None:
                        continue
                    if len(result) == 6:
                        idx, leg_key, coords, alts, is_fallback, danger_level = result
                    elif len(result) == 5:
                        idx, leg_key, coords, alts, is_fallback = result
                        danger_level = None
                    else:
                        idx, leg_key, coords, alts = result
                        is_fallback = False
                        danger_level = None
                    leg_results[idx] = (leg_key, coords, is_fallback, danger_level)
                    all_alts[idx] = alts
                    completed += 1
                    label = f"{stages[idx]['label']} → {stages[idx+1]['label']}"
                    self.progress_update.emit(
                        f"Étape {label} calculée ({completed}/{total})"
                    )

            # ── Post-processing: overlap detection ────────
            grid = _SpatialGrid(cell_size=0.0003)  # ~30m cells
            final_leg_routes = []
            all_coords = []

            for i in range(len(stages) - 1):
                if leg_results[i] is None:
                    continue

                leg_key, coords, is_fallback, danger_level = leg_results[i]
                alts = all_alts[i]

                # Check overlap against all previous legs
                if all_coords and alts and len(alts) > 1:
                    nearby = grid.count_nearby(coords)
                    overlap_ratio = nearby / max(len(coords), 1)
                    if overlap_ratio > 0.15:
                        # Try alternative routes
                        for alt in alts[1:]:
                            alt_coords = alt["geometry"].get("coordinates", [])
                            alt_nearby = grid.count_nearby(alt_coords)
                            if (alt_nearby / max(len(alt_coords), 1)) < 0.15:
                                coords = alt_coords
                                is_fallback = alt.get("is_fallback", False) # Update flag if we pick alternative
                                danger_level = alt.get("danger_level", None)
                                break

                # Insert into spatial grid for future overlap checks
                grid.insert_points(coords)

                leg_name = f"{stages[i]['label']} → {stages[i+1]['label']}"
                leg_geom = {
                    "type": "LineString", 
                    "coordinates": coords,
                    "properties": {
                        "is_fallback": is_fallback,
                        "danger_level": danger_level
                    }  # Embed the dangerous road flags here
                }
                final_leg_routes.append((leg_name, leg_key, leg_geom))

                if all_coords and coords:
                    all_coords.extend(coords[1:])
                else:
                    all_coords.extend(coords)

            self.route_calculated.emit(stages, final_leg_routes, all_coords)

        except Exception as e:
            self.calculation_error.emit(str(e))

class ExportWarningDialog(QDialog):
    def __init__(self, violations, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Validation de l'itinéraire")
        self.setMinimumWidth(500)
        layout = QVBoxLayout(self)
        
        layout.addWidget(QLabel("<b>Certaines conditions de placement ne sont pas respectées :</b>"))
        
        self.list = QListWidget()
        for v in violations:
            msg = v['message']
            item = QListWidgetItem(msg)
            if v['level'] == 'error':
                item.setForeground(Qt.red)
            else:
                item.setForeground(Qt.darkYellow)
            item.setData(Qt.UserRole, v.get('explanation', ''))
            self.list.addItem(item)
        layout.addWidget(self.list)
        
        layout.addWidget(QLabel("<i>Explication / Conseil :</i>"))
        self.details = QTextEdit()
        self.details.setReadOnly(True)
        self.details.setMaximumHeight(100)
        layout.addWidget(self.details)
        
        self.list.currentItemChanged.connect(self.on_selection_changed)
        
        btns = QHBoxLayout()
        self.btn_ignore = QPushButton("Exporter quand même")
        self.btn_cancel = QPushButton("Annuler - Revenir à l'édition")
        self.btn_cancel.setDefault(True)
        
        btns.addWidget(self.btn_ignore)
        btns.addWidget(self.btn_cancel)
        layout.addLayout(btns)
        
        self.btn_ignore.clicked.connect(self.accept)
        self.btn_cancel.clicked.connect(self.reject)
        
        if self.list.count() > 0:
            self.list.setCurrentRow(0)
        
    def on_selection_changed(self, current, previous):
        if current:
            self.details.setText(current.data(Qt.UserRole))


class _ExportWorker(QThread):
    """
    Worker dédié à la génération PDF — tourne dans un thread séparé.
    Signals :
      export_done(success: bool, error: str, pdf_part: str, pdf_sol: str)
      progress_update(message: str)
    """
    export_done = _Signal(bool, str, str, str)
    progress_update = _Signal(str, int)

    def __init__(self, state_manager, output_dir=None):
        super().__init__()
        self.state_manager = state_manager
        self.output_dir = output_dir

    def run(self):
        try:
            self.progress_update.emit("Démarrage de l'orchestrateur...", 0)
            from main_orchestrator import Orchestrator
            orch = Orchestrator(self.state_manager)

            def cb(msg, p=None):
                self.progress_update.emit(msg, p if p is not None else -1)

            # PASSING output_dir and callback to generate_pdf_from_gui
            paths = orch.generate_pdf_from_gui(output_dir=self.output_dir, progress_callback=cb)

            if isinstance(paths, tuple) and len(paths) == 2:
                pdf_part, pdf_sol = paths
            else:
                # Fallback : chercher par nom de thème
                import utils.pdf_helpers as ph
                base = ph.get_theme_label('filename', 'Carnet_Contrebandier')
                base_dir = os.path.dirname(os.path.abspath(__file__))
                pdf_part = os.path.join(base_dir, f"{base}.pdf")
                pdf_sol  = os.path.join(base_dir, f"{base}_SOLUCE.pdf")

            self.progress_update.emit("Export terminé avec succès.", 100)
            self.export_done.emit(True, "", str(pdf_part), str(pdf_sol))

        except Exception as exc:
            import traceback
            self.export_done.emit(False, traceback.format_exc(), "", "")


class ExportProgressDialog(QDialog):
    """Dialogue de progression détaillé avec console de log."""
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("Génération du Carnet Scout")
        self.setMinimumSize(600, 450)
        self.setWindowModality(Qt.WindowModal)
        
        layout = QVBoxLayout(self)
        layout.setContentsMargins(20, 20, 20, 20)
        layout.setSpacing(15)
        
        # Titre et indicateur de phase
        self.title_label = QLabel("<b>Préparation de l'export...</b>")
        self.title_label.setStyleSheet("font-size: 14px;")
        layout.addWidget(self.title_label)
        
        # Barre de progression
        self.progress_bar = QProgressBar()
        self.progress_bar.setStyleSheet("""
            QProgressBar {
                border: 2px solid #333;
                border-radius: 5px;
                text-align: center;
                height: 25px;
                background: #1e1e1e;
            }
            QProgressBar::chunk {
                background-color: #5c5cff;
                width: 20px;
            }
        """)
        layout.addWidget(self.progress_bar)
        
        # Console de log
        layout.addWidget(QLabel("Détails de la génération :"))
        self.log_view = QPlainTextEdit()
        self.log_view.setReadOnly(True)
        self.log_view.setStyleSheet("""
            QPlainTextEdit {
                background-color: #0c0c0c;
                color: #00ff00;
                font-family: 'Consolas', 'Courier New', monospace;
                font-size: 11px;
                border: 1px solid #444;
            }
        """)
        layout.addWidget(self.log_view)
        
        # Bouton fermer (désactivé pendant l'export)
        self.close_btn = QPushButton("Fermer")
        self.close_btn.setEnabled(False)
        self.close_btn.clicked.connect(self.accept)
        layout.addWidget(self.close_btn)

    def log(self, message, percentage=-1):
        if percentage >= 0:
            self.progress_bar.setValue(percentage)
        
        if message:
            self.title_label.setText(f"<b>{message}</b>")
            self.log_view.appendPlainText(f"> {message}")
            # Auto-scroll
            self.log_view.verticalScrollBar().setValue(self.log_view.verticalScrollBar().maximum())


class ScoutWorkspace(QMainWindow):
    def __init__(self):
        super().__init__()
        self.logger = logging.getLogger("ScoutWorkspace")
        self.setWindowTitle("ScoutRaider Suite — Générateur de Carnets")
        self.setWindowIcon(QIcon(os.path.join(PROJECT_ROOT, "assets", "icon.ico")))
        self.resize(1280, 800)
        
        # 1. Core Services
        self.state_manager = StateManager()
        self.presets_manager = PresetsManager()
        self.validator = ConstraintValidator()
        self.ign_client = IGNClient()
        
        # Route tool state
        self._route_click_count = 0
        self._stage_anchor_idx = -1
        self._route_selection_mode = False
        self._pending_alternatives = []
        self._pending_stages = []
        self._pending_leg_idx = -1
        
        # 2. Central Widget = Map
        self.map_view = MapView(self.state_manager)
        self.setCentralWidget(self.map_view)
        
        # 3. Dockable Panels
        self.setup_docks()
        
        # 5. Connect Signals
        self._leg_choices = {} # Cache for route choices: {key: geometry}
        self._route_selection_mode = False
        self._connect_signals()
        
        # 6. Menus & Toolbars
        self.setup_menus()
        self.setup_toolbars()
        
        # 7. Status Bar
        self.setStatusBar(QStatusBar(self))
        self.statusBar().showMessage("Prêt")

        # --- BACKGROUND ENGINE ---
        import sys
        import os
        project_root = os.path.dirname(os.path.abspath(__file__))
        if project_root not in sys.path:
            sys.path.insert(0, project_root)
        
        try:
            from utils.background_engine import JobQueueWorker, JobType
            self.bg_engine = JobQueueWorker(self.ign_client)
            self.bg_engine.job_finished.connect(self._on_bg_job_finished)
            self.bg_engine.job_failed.connect(lambda j, t, e: self.statusBar().showMessage(f"Erreur arrière-plan ({t}): {e}", 4000))
            self.bg_engine.start()
        except Exception as e:
            print("Failed to initialize bg_engine:", e)
            
        # --- AUTO-UPDATER ---
        self._check_for_updates()

    def _check_for_updates(self, manual=False):
        """Démarre le thread de vérification des mises à jour en arrière-plan."""
        self.updater_thread = UpdateCheckerThread()
        self.updater_thread.manual_mode = manual
        self.updater_thread.update_available.connect(self._on_update_available)
        self.updater_thread.error_occurred.connect(self._on_update_error)
        self.updater_thread.finished.connect(lambda: self._on_update_check_finished(manual))
        self.updater_thread.start()
        if manual:
            self.statusBar().showMessage("Vérification des mises à jour...", 3000)

    def _on_update_check_finished(self, manual):
        """Called when the update check thread finishes (even if no update found)."""
        if manual and not hasattr(self, "_update_found_flag"):
             QMessageBox.information(self, "Mise à jour", "Votre version de ScoutRaider Suite est à jour !")
        if hasattr(self, "_update_found_flag"):
            delattr(self, "_update_found_flag")

    def _on_update_available(self, tag, name, body, url):
        """Affiche une boîte de dialogue si une nouvelle version est trouvée."""
        self._update_found_flag = True
        msg = QMessageBox(self)
        msg.setWindowTitle("Mise à jour disponible")
        msg.setText(f"Une nouvelle version <b>{tag}</b> ({name}) est disponible !")
        msg.setInformativeText("Souhaitez-vous la télécharger sur GitHub ?")
        msg.setDetailedText(body)

        btn_yes = msg.addButton("Télécharger", QMessageBox.ActionRole)
        btn_no = msg.addButton("Plus tard", QMessageBox.RejectRole)
        
        msg.exec()
        
        if msg.clickedButton() == btn_yes:
            import webbrowser
            webbrowser.open(url)

    def _on_update_error(self, error_msg):
        """Affiche une erreur si la vérification manuelle échoue."""
        if hasattr(self.updater_thread, 'manual_mode') and self.updater_thread.manual_mode:
            QMessageBox.warning(self, "Mise à jour", error_msg)

    def _assemble_polygonal_steps(self, leg_routes=None):
        """Build the flat `polygonal_steps` array matching the current sequence of stages."""
        if leg_routes is None:
            # Reconstruct leg_routes from state if not provided
            routes = self.state_manager.get_state("routes", [])
            leg_routes = []
            for r in routes:
                if r.get("visible", True):
                    # In real flow we pass leg_routes directly, so we just extract keys
                    leg_routes.append((r.get("name", ""), r.get("leg_key", ""), None))
                    
        polygonal_legs = self.state_manager.get_state("polygonal_legs", {})
        flat_steps = []
        for leg_name, leg_key, _ in leg_routes:
            segments = polygonal_legs.get(leg_key, [])
            flat_steps.extend(segments)
            
        self.state_manager.update_state("polygonal_steps", flat_steps)
        self.on_poly_updated()

    def _on_bg_job_finished(self, job_id, job_type, result):
        if job_type == "azimut_leg":
            if not result: return
            segments = result
            
            if job_id.startswith("azimut_"):
                leg_key = job_id.replace("azimut_", "")
                
                # Tag segments with their leg_key to allow targeted UI effects (like fading a whole leg)
                for seg in segments:
                    seg["leg_key"] = leg_key
                
                # Update cache
                polygonal_legs = self.state_manager.get_state("polygonal_legs", {})
                polygonal_legs[leg_key] = segments
                self.state_manager.update_state("polygonal_legs", polygonal_legs)
                
                # Remove from pending status
                pending_legs = self.state_manager.get_state("pending_azimut_legs", [])
                if leg_key in pending_legs:
                    pending_legs.remove(leg_key)
                    self.state_manager.update_state("pending_azimut_legs", pending_legs)
                    
                self._assemble_polygonal_steps()
            elif job_id == "global_azimut_manual":
                self.state_manager.update_state("polygonal_steps", segments)
                self.on_poly_updated()

    # ═══════════════════════════════════════════════════════
    # SIGNAL WIRING
    # ═══════════════════════════════════════════════════════
    
    def _connect_signals(self):
        # Map → Main
        self.map_view.method_dropped.connect(self.on_method_dropped)
        self.map_view.segment_menu_requested.connect(self.on_segment_menu)
        self.map_view.node_menu_requested.connect(self.on_node_menu)
        self.map_view.azimut_updated.connect(self.on_azimut_manually_updated)
        self.map_view.segments_merged.connect(self.on_segments_merged)
        self.map_view.node_added.connect(self.on_node_added)
        self.map_view.node_removed.connect(self.on_node_removed)
        self.map_view.node_moved.connect(self.on_node_moved)
        self.map_view.batch_assign.connect(self.on_batch_assign)
        self.map_view.search_suggestions_requested.connect(self.on_map_search_autocomplete)
        self.map_view.calculate_route_with_points_requested.connect(self.on_ign_route_with_points)
        self.map_view.reset_route_requested.connect(self.on_reset_itinerary)
        self.map_view.basemap_changed.connect(self.on_basemap_changed)
        self.map_view.map_clicked.connect(self.on_map_clicked)
        self.map_view.stage_clicked.connect(self.on_stage_clicked)
        self.map_view.stage_hovered.connect(self.on_stage_hovered)
        self.map_view.stage_delete_requested.connect(self.on_stage_delete_requested)
        self.map_view.route_alternative_selected.connect(self.on_route_alternative_selected)
        self.map_view.danger_validated.connect(self.on_danger_validated)
        # Segmentation Panel → Main
        self.tools_panel.map_needs_update.connect(self.delayed_map_update)
        self.tools_panel.poly_needs_update.connect(self.on_poly_updated)
        if hasattr(self.tools_panel, 'manual_recalc_requested'):
            self.tools_panel.manual_recalc_requested.connect(self.on_routes_changed)
        
        # Route Panel → Main
        self.route_panel.routes_changed.connect(self.on_routes_changed)
        self.route_panel.map_needs_update.connect(lambda: self.delayed_map_update())
        self.route_panel.stages_reordered.connect(self._on_stages_reordered)
        
        # Difficulty Panel → Main
        self.difficulty_panel.assignment_changed.connect(self.delayed_map_update)
        self.difficulty_panel.trigger_export.connect(self.run_export_pipeline)
        
        # State Manager → Main
        self.state_manager.state_changed.connect(self.on_state_changed_globally)

    # ═══════════════════════════════════════════════════════
    # STATE CHANGE HANDLER
    # ═══════════════════════════════════════════════════════
    
    def on_state_changed_globally(self, key, value):
        if key == "all":
            self.refresh_ui()
        elif key == "polygonal_steps":
            self.delayed_map_update()
        elif key == "active_tool":
            if value == "select":
                self.context_lbl.setText("SÉLECTION  |  Cliquez sur un tronçon pour l'inspecter")
            elif value == "node":
                self.context_lbl.setText("NŒUDS  |  Placer un point (Clic) · Déplacer (Drag) · Supprimer (Maintien Alt + Clic)")
            elif value == "azimut":
                self.context_lbl.setText("AZIMUT  |  Déplacez la poignée bleue pour forcer l'azimut d'un tronçon")
            elif value == "encodage":
                self.context_lbl.setText("ENCODAGE  |  Tracez une zone (Box) ou utilisez Shift/Ctrl+Clic pour multi-sélection")
            elif value == "route":
                self.context_lbl.setText("ITINÉRAIRE  |  Cliquez sur la carte pour définir les étapes")
                self._route_click_count = 0
            self.map_view.set_interaction_tool(value)

    # ═══════════════════════════════════════════════════════
    # MENUS
    # ═══════════════════════════════════════════════════════
    
    def setup_menus(self):
        menubar = self.menuBar()
        
        # --- File ---
        file_menu = menubar.addMenu("&Fichier")
        
        new_act = QAction("Nouveau Projet", self)
        new_act.setShortcut("Ctrl+N")
        new_act.triggered.connect(self.on_new_project)
        file_menu.addAction(new_act)
        
        open_act = QAction("Ouvrir Projet...", self)
        open_act.setShortcut("Ctrl+O")
        open_act.triggered.connect(self.on_open_project)
        file_menu.addAction(open_act)
        
        file_menu.addSeparator()
        
        save_act = QAction("Enregistrer", self)
        save_act.setShortcut("Ctrl+S")
        save_act.triggered.connect(self.on_save_project)
        file_menu.addAction(save_act)
        
        save_as_act = QAction("Enregistrer sous...", self)
        save_as_act.setShortcut("Ctrl+Shift+S")
        save_as_act.triggered.connect(self.on_save_project_as)
        file_menu.addAction(save_as_act)
        
        file_menu.addSeparator()
        
        export_act = QAction("Exporter en PDF", self)
        export_act.setShortcut("Ctrl+E")
        export_act.triggered.connect(self.run_export_pipeline)
        file_menu.addAction(export_act)
        
        # --- Edit ---
        edit_menu = menubar.addMenu("&Édition")
        
        undo_act = QAction("Annuler", self)
        undo_act.setShortcut("Ctrl+Z")
        undo_act.triggered.connect(self.state_manager.undo)
        edit_menu.addAction(undo_act)
        
        redo_act = QAction("Rétablir", self)
        redo_act.setShortcut("Ctrl+Y")
        redo_act.triggered.connect(self.state_manager.redo)
        edit_menu.addAction(redo_act)
        
        # --- Fenêtres ---
        window_menu = menubar.addMenu("&Fenêtres")
        window_menu.addAction(self.dock_route.toggleViewAction())
        window_menu.addAction(self.dock_segmentation.toggleViewAction())
        window_menu.addAction(self.dock_modules.toggleViewAction())
        window_menu.addAction(self.dock_difficulty.toggleViewAction())
        
        window_menu.addSeparator()
        
        # --- Sous-menu Espaces de travail ---
        ws_menu = window_menu.addMenu("Espaces de travail")
        
        ws_complet = ws_menu.addAction("Complet")
        ws_complet.triggered.connect(lambda: self._apply_workspace("complet"))
        
        ws_carte = ws_menu.addAction("Carte seule")
        ws_carte.triggered.connect(lambda: self._apply_workspace("carte_seule"))
        
        ws_creation = ws_menu.addAction("Création d'itinéraire")
        ws_creation.triggered.connect(lambda: self._apply_workspace("creation"))
        
        ws_export = ws_menu.addAction("Export")
        ws_export.triggered.connect(lambda: self._apply_workspace("export"))
        
        ws_menu.addSeparator()
        
        # Custom workspaces from QSettings
        self._ws_menu = ws_menu
        self._rebuild_custom_ws_menu()
        
        ws_menu.addSeparator()
        ws_save = ws_menu.addAction("Enregistrer la disposition actuelle...")
        ws_save.triggered.connect(self._save_custom_workspace)
        
        # --- Aide ---
        help_menu = menubar.addMenu("&Aide")
        
        upd_act = QAction("🔄 Vérifier les mises à jour...", self)
        upd_act.triggered.connect(lambda: self._check_for_updates(manual=True))
        help_menu.addAction(upd_act)
        help_menu.addSeparator()
        
        guide_act = QAction("📖 Guide du Raid", self)
        guide_act.setShortcut("F1")
        guide_act.triggered.connect(lambda: self._show_help(0))
        help_menu.addAction(guide_act)
        
        roadmap_act = QAction("🚀 Nouveautés & Roadmap", self)
        roadmap_act.triggered.connect(lambda: self._show_help(1))
        help_menu.addAction(roadmap_act)
        
        suggest_act = QAction("💡 Suggestions & Feedback", self)
        suggest_act.triggered.connect(lambda: self._show_help(2))
        help_menu.addAction(suggest_act)
        
        help_menu.addSeparator()
        
        about_act = QAction("À propos", self)
        about_act.triggered.connect(self._show_about)
        help_menu.addAction(about_act)

    # ═══════════════════════════════════════════════════════
    # TOOLBARS
    # ═══════════════════════════════════════════════════════
    
    def setup_toolbars(self):
        from PySide6.QtWidgets import QToolBar
        
        # --- LEFT TOOLBAR (Photoshop Style) ---
        self.left_toolbar = QToolBar("Outils", self)
        self.left_toolbar.setObjectName("toolbar_outils")
        self.left_toolbar.setMovable(False)
        self.left_toolbar.setIconSize(self.left_toolbar.iconSize() * 1.5)
        self.left_toolbar.setStyleSheet("""
            QToolBar { background-color: #333; border-right: 1px solid #111; spacing: 10px; padding: 5px; }
            QToolButton { background-color: transparent; border-radius: 5px; padding: 5px; color: white; font-weight: bold; }
            QToolButton:checked { background-color: #007acc; }
            QToolButton:hover { background-color: #444; }
        """)
        self.addToolBar(Qt.LeftToolBarArea, self.left_toolbar)
        
        self.tool_group = QActionGroup(self)
        self.tool_group.setExclusive(True)
        
        # Outil Route (R)
        self.route_tool_act = self.left_toolbar.addAction("R")
        self.route_tool_act.setToolTip("Outil Route (R) — Gérer les étapes")
        self.route_tool_act.setShortcut("R")
        self.route_tool_act.setCheckable(True)
        self.route_tool_act.setChecked(True)
        self.route_tool_act.setActionGroup(self.tool_group)
        self.route_tool_act.triggered.connect(lambda: self.set_active_tool("route"))
        
        # Outil Nœuds (N)
        self.node_tool_act = self.left_toolbar.addAction("N")
        self.node_tool_act.setToolTip("Outil Nœuds (N) — Ajouter/supprimer des nœuds")
        self.node_tool_act.setShortcut("N")
        self.node_tool_act.setCheckable(True)
        self.node_tool_act.setActionGroup(self.tool_group)
        self.node_tool_act.triggered.connect(lambda: self.set_active_tool("node"))
        
        # Outil Azimut (A)
        self.azimut_tool_act = self.left_toolbar.addAction("A")
        self.azimut_tool_act.setToolTip("Outil Azimut (A) — Éditer les azimuts")
        self.azimut_tool_act.setShortcut("A")
        self.azimut_tool_act.setCheckable(True)
        self.azimut_tool_act.setActionGroup(self.tool_group)
        self.azimut_tool_act.triggered.connect(lambda: self.set_active_tool("azimut"))
        
        # Outil Encodage (E)
        self.encodage_tool_act = self.left_toolbar.addAction("E")
        self.encodage_tool_act.setToolTip("Outil Encodage (E) — Assigner une épreuve")
        self.encodage_tool_act.setShortcut("E")
        self.encodage_tool_act.setCheckable(True)
        self.encodage_tool_act.setActionGroup(self.tool_group)
        self.encodage_tool_act.triggered.connect(lambda: self.set_active_tool("encodage"))
        
        # --- Separator + Help Button ---
        self.left_toolbar.addSeparator()
        
        self.help_tool_act = self.left_toolbar.addAction("?")
        self.help_tool_act.setToolTip("Aide — Guide du Raid, Roadmap, Suggestions (F1)")
        self.help_tool_act.setCheckable(False)
        self.help_tool_act.triggered.connect(lambda: self._show_help(0))
        
        # --- TOP CONTEXTUAL TOOLBAR ---
        self.context_toolbar = QToolBar("Options", self)
        self.context_toolbar.setObjectName("toolbar_options")
        self.context_toolbar.setMovable(False)
        self.context_toolbar.setStyleSheet("background-color: #252526; color: #ccc; border-bottom: 1px solid #111;")
        self.addToolBar(Qt.TopToolBarArea, self.context_toolbar)
        
        self.context_lbl = QLabel("ROUTE | Cliquez sur la carte pour placer la première étape")
        self.context_lbl.setStyleSheet("margin-left: 10px; font-weight: 600; color: #999; font-size: 11px;")
        self.context_toolbar.addWidget(self.context_lbl)
        
        self.set_active_tool("route")

    def _show_help(self, tab_index: int = 0):
        """Open the Help dialog on the specified tab."""
        from ui.workspace.help_dialog import HelpDialog
        dlg = HelpDialog(self, initial_tab=tab_index)
        dlg.exec()

    def _show_about(self):
        """Show the About dialog with version and safety warning."""
        try:
            from version import __version__, APP_NAME, APP_AUTHOR
        except ImportError:
            __version__ = "0.1.0-beta"
            APP_NAME = "ScoutRaider Suite"
            APP_AUTHOR = "Pierre-Albéric Théobald, chef de troupe de la Première Port-Marly"

        QMessageBox.about(self, f"À propos de {APP_NAME}",
            f"<h2>{APP_NAME}</h2>"
            f"<p>Version <b>{__version__}</b></p>"
            f"<p>{APP_AUTHOR}</p>"
            f"<hr>"
            f"<p style='color: #ff9800;'><b>⚠️ Avertissement :</b> Les azimuts et métrages "
            f"sont calculés algorithmiquement et peuvent contenir des erreurs. "
            f"Vérifiez toujours manuellement avant d'envoyer des scouts sur le terrain.</p>"
        )

    # Tool context messages
    TOOL_CONTEXT = {
        "node": "NŒUD | Cliquez sur un tronçon pour ajouter, sur un nœud pour supprimer",
        "azimut": "AZIMUT | Glissez les poignées bleues pour modifier la direction",
        "encodage": "ENCODAGE | Cliquez sur un tronçon pour assigner une épreuve",
        "route": "ROUTE | Cliquez sur un point d'ancrage pour ajouter une étape",
    }

    def set_active_tool(self, tool_id):
        self.state_manager.update_state("active_tool", tool_id)
        stages = self.state_manager.get_state("stages", [])
        
        # Reset stage anchor by default
        self._stage_anchor_idx = -1
        
        # Determine context label and auto-anchor for route tool
        lbl_text = self.TOOL_CONTEXT.get(tool_id, "")
        if tool_id == "route" and stages:
            self._stage_anchor_idx = len(stages) - 1
            last_stage = stages[-1]
            letter = last_stage.get('label', chr(65 + len(stages) - 1))
            lbl_text = f"ROUTE | Ancré sur {letter}. Cliquez pour prolonger."

        self.context_lbl.setText(lbl_text)
        
        # Forward to JS map
        if hasattr(self, 'map_view'):
            self.map_view.set_interaction_tool(tool_id)
            self.map_view.hide_dashed_preview()
            
            # Render waypoints only for route tool
            self.map_view.render_waypoints(stages if tool_id == "route" else [])
            
            # Show cursor letter and auto-anchor preview for route tool
            if tool_id == "route":
                self._update_cursor_letter()
                if stages:
                    last_stage = stages[-1]
                    self.map_view.show_dashed_preview(last_stage['lat'], last_stage['lon'], self._stage_anchor_idx)
            else:
                self.map_view.web_view.page().runJavaScript(
                    "if(typeof clearCursorLetter==='function') clearCursorLetter();"
                )

    # ═══════════════════════════════════════════════════════
    # DOCKS — 4 panels, Photoshop-style
    # ═══════════════════════════════════════════════════════
    
    def setup_docks(self):
        self.setDockOptions(
            QMainWindow.AllowNestedDocks | 
            QMainWindow.AllowTabbedDocks | 
            QMainWindow.AnimatedDocks |
            QMainWindow.GroupedDragging
        )
        
        # Tabs on TOP for all dock areas
        self.setTabPosition(Qt.LeftDockWidgetArea, QTabWidget.North)
        self.setTabPosition(Qt.RightDockWidgetArea, QTabWidget.North)
        self.setTabPosition(Qt.TopDockWidgetArea, QTabWidget.North)
        self.setTabPosition(Qt.BottomDockWidgetArea, QTabWidget.North)
        
        # --- LEFT: Route Panel ---
        self.dock_route = QDockWidget("Itin\u00e9raire", self)
        self.dock_route.setObjectName("dock_itineraires")
        self.route_panel = RoutePanel(self.state_manager)
        self.dock_route.setWidget(self.route_panel)
        self.addDockWidget(Qt.LeftDockWidgetArea, self.dock_route)
        
        # --- GAUCHE : Segmentation (onglet avec Itinéraires) ---
        self.dock_segmentation = QDockWidget("Segmentation", self)
        self.dock_segmentation.setObjectName("dock_segmentation")
        self.tools_panel = ToolsPanel(self.state_manager)
        self.dock_segmentation.setWidget(self.tools_panel)
        self.addDockWidget(Qt.LeftDockWidgetArea, self.dock_segmentation)
        self.tabifyDockWidget(self.dock_route, self.dock_segmentation)
        
        # --- DROITE : Épreuves ---
        self.dock_modules = QDockWidget("Modules", self)
        self.dock_modules.setObjectName("dock_modules")
        self.library_widget = LibraryDock(self.state_manager)
        self.dock_modules.setWidget(self.library_widget)
        self.addDockWidget(Qt.RightDockWidgetArea, self.dock_modules)
        
        # --- DROITE : Difficulté (onglet avec Épreuves) ---
        self.dock_difficulty = QDockWidget("Difficulté", self)
        self.dock_difficulty.setObjectName("dock_difficulte")
        self.difficulty_panel = DifficultyPanel(self.state_manager, self.presets_manager)
        self.dock_difficulty.setWidget(self.difficulty_panel)
        self.addDockWidget(Qt.RightDockWidgetArea, self.dock_difficulty)
        self.tabifyDockWidget(self.dock_modules, self.dock_difficulty)
        
        # --- DROITE : Thème (onglet avec Difficulté) ---
        self.dock_theme = QDockWidget("Thème", self)
        self.dock_theme.setObjectName("dock_theme")
        from ui.workspace.theme_panel import ThemePanel
        self.theme_panel = ThemePanel(self.state_manager)
        self.dock_theme.setWidget(self.theme_panel)
        self.addDockWidget(Qt.RightDockWidgetArea, self.dock_theme)
        self.tabifyDockWidget(self.dock_difficulty, self.dock_theme)
        
        # Raise default tabs
        self.dock_route.raise_()
        self.dock_modules.raise_()

    def load_stylesheet(self):
        curr_dir = os.path.dirname(os.path.abspath(__file__))
        qss_path = os.path.join(curr_dir, "ui", "workspace", "style.qss")
        if os.path.exists(qss_path):
            with open(qss_path, "r", encoding='utf-8') as f:
                self.setStyleSheet(f.read())

    # ═══════════════════════════════════════════════════════
    # MAP CLICK HANDLER — Route tool integration
    # ═══════════════════════════════════════════════════════
    
    def on_map_clicked(self, lat, lon):
        """Handle map clicks — étapes state machine when Route tool is active."""
        if self.state_manager.get_state("active_tool") != "route":
            return
        
        stages = self.state_manager.get_state("stages", [])
        
        if self._stage_anchor_idx >= 0:
            # ANCHORED/INSERTION MODE
            anchor = self._stage_anchor_idx
            self.state_manager.push_to_history()
            
            if anchor == len(stages) - 1:
                # Append after last stage
                new_stage = {"lat": lat, "lon": lon, "label": "-"}
                stages.append(new_stage)
            else:
                # INSERTION: splice between anchor and anchor + 1
                new_stage = {"lat": lat, "lon": lon, "label": "-"} 
                stages.insert(anchor + 1, new_stage)
            
            # Re-label all sequentially
            for i, s in enumerate(stages):
                s["label"] = chr(65 + i)
                
            self.state_manager.update_state("stages", stages)
            self.map_view.web_view.page().runJavaScript("if(typeof unfadeAllLegs==='function') unfadeAllLegs();")
            
            # Auto-anchor on the newly placed point
            new_idx = anchor + 1
                
            self._stage_anchor_idx = new_idx
            self.map_view.show_dashed_preview(lat, lon, new_idx)
            
            self._calculate_route_for_stages(stages)
            self._refresh_stages()
            self.context_lbl.setText("ROUTE | Étape ajoutée. Cliquez pour continuer")
            return
        
        if len(stages) == 0:
            # First click: create A
            self.state_manager.push_to_history()
            stages.append({"lat": lat, "lon": lon, "label": "A"})
            self.state_manager.update_state("stages", stages)
            self._refresh_stages()
            self._sync_route_panel_with_stages()
            # Show dashed preview from A and auto-anchor
            self._stage_anchor_idx = 0
            self.map_view.show_dashed_preview(lat, lon, 0)
            self.context_lbl.setText("ROUTE | Ancré sur A. Cliquez pour prolonger")
            self.statusBar().showMessage(f"Départ A : {lat:.5f}, {lon:.5f}", 3000)
            return
        
        if len(stages) == 1:
            # Second click: create B + calculate route
            self.state_manager.push_to_history()
            stages.append({"lat": lat, "lon": lon, "label": "B"})
            self.state_manager.update_state("stages", stages)
            self._stage_anchor_idx = 1
            self.map_view.show_dashed_preview(lat, lon, 1)
            self._calculate_route_for_stages(stages)
            self._refresh_stages()
            self._sync_route_panel_with_stages()
            self.context_lbl.setText("ROUTE | Itinéraire A→B calculé. Cliquez pour prolonger")
            self.statusBar().showMessage(f"Arrivée B : {lat:.5f}, {lon:.5f}", 3000)
            return
        
        # Default: no anchor selected, ignore map clicks with >1 stage
        self.context_lbl.setText("ROUTE | Cliquez sur A ou " + stages[-1]["label"] + " pour prolonger")
    
    def on_stage_clicked(self, stage_idx):
        """Handle click on a waypoint marker — anchor for extension/insertion."""
        stages = self.state_manager.get_state("stages", [])
        if stage_idx < 0 or stage_idx >= len(stages):
            return
        
        # Toggle anchor: un-anchor if already on this point
        if self._stage_anchor_idx == stage_idx:
            self._stage_anchor_idx = -1
            self.map_view.hide_dashed_preview()
            self.map_view.web_view.page().runJavaScript("if(typeof unfadeAllLegs==='function') unfadeAllLegs();")
            self.context_lbl.setText(self.TOOL_CONTEXT["route"])
            return
        
        self._stage_anchor_idx = stage_idx
        s = stages[stage_idx]
        self.map_view.show_dashed_preview(s["lat"], s["lon"])
        
        is_extremity = (stage_idx == 0 or stage_idx == len(stages) - 1)
        if is_extremity:
            self.context_lbl.setText(f"ROUTE | Ancré sur {s['label']}. Cliquez pour prolonger")
        else:
            # Intermediate: fade the leg after this point (will be split)
            import json as _json
            self.map_view.web_view.page().runJavaScript(
                f"if(typeof fadeLegs==='function') fadeLegs({_json.dumps([stage_idx])});"
            )
            self.context_lbl.setText(f"ROUTE | Ancré sur {s['label']}. Cliquez pour insérer après")
    
    def on_stage_delete_requested(self, stage_idx):
        """Handle right-click delete on a waypoint marker."""
        stages = self.state_manager.get_state("stages", [])
        if stage_idx < 0 or stage_idx >= len(stages):
            return
        
        self.state_manager.push_to_history()
        removed = stages.pop(stage_idx)
        # Re-label
        for i, s in enumerate(stages):
            s["label"] = chr(65 + i)
        self.state_manager.update_state("stages", stages)
        self._stage_anchor_idx = -1
        self.map_view.hide_dashed_preview()
        
        if len(stages) >= 2:
            self._calculate_route_for_stages(stages)
        
        self._refresh_stages()
        self._sync_route_panel_with_stages()
        self.context_lbl.setText(f"ROUTE | Étape {removed['label']} supprimée")
    
    def _sync_route_panel_with_stages(self):
        """Refresh the route panel UI from the current stages state."""
        self.route_panel.refresh_from_state()
    
    def _auto_assign_stages_from_routes(self):
        """On project load, assign A/B stages from existing routes if no stages exist."""
        stages = self.state_manager.get_state("stages", [])
        if stages:
            return  # Already has stages
        
        routes = self.state_manager.get_state("routes", [])
        if not routes:
            return
        
        # Get coordinates from first visible route
        for route in routes:
            geom = route.get("geometry", {})
            coords = geom.get("coordinates", [])
            if coords and len(coords) >= 2:
                first_coord = coords[0]   # [lon, lat]
                last_coord = coords[-1]    # [lon, lat]
                stages = [
                    {"lat": first_coord[1], "lon": first_coord[0], "label": "A"},
                    {"lat": last_coord[1], "lon": last_coord[0], "label": "B"},
                ]
                self.state_manager.update_state("stages", stages)
                self._refresh_stages()
                self._sync_route_panel_with_stages()
                break
    
    def on_stage_hovered(self, stage_idx):
        """Handle hover on a waypoint — fade adjacent legs for deletion preview."""
        if stage_idx < 0:
            # Unhover: unfade all
            self.map_view.web_view.page().runJavaScript("if(typeof unfadeAllLegs==='function') unfadeAllLegs();")
            return
        
        stages = self.state_manager.get_state("stages", [])
        if stage_idx >= len(stages):
            return
        
        # Fade adjacent legs
        legs_to_fade = []
        if stage_idx > 0:
            legs_to_fade.append(stage_idx - 1)
        if stage_idx < len(stages) - 1:
            legs_to_fade.append(stage_idx)
        
        import json as _json
        self.map_view.web_view.page().runJavaScript(
            f"if(typeof fadeLegs==='function') fadeLegs({_json.dumps(legs_to_fade)});"
        )
    
    def _refresh_stages(self):
        """Re-render waypoints on the map and update cursor letter."""
        stages = self.state_manager.get_state("stages", [])
        self.map_view.render_waypoints(stages)
        self._update_cursor_letter()
    
    def _update_cursor_letter(self):
        """Update the cursor letter to show what stage will be created next."""
        stages = self.state_manager.get_state("stages", [])
        
        if getattr(self, '_stage_anchor_idx', -1) >= 0:
            anchor = self._stage_anchor_idx
            if anchor == 0:
                next_letter = "A"
            elif anchor == len(stages) - 1:
                next_letter = chr(65 + len(stages))
            else:
                next_letter = chr(65 + anchor + 1)
        else:
            next_letter = chr(65 + len(stages))  # A, B, C...
            
        import json as _json
        self.map_view.web_view.page().runJavaScript(
            f"if(typeof setCursorLetter==='function') setCursorLetter({_json.dumps(next_letter)});"
        )
    
    def _calculate_route_for_stages(self, stages):
        """Calculate routes between consecutive stages — parallel, non-blocking.
        
        Uses _RouteCalculationWorker (QThread + ThreadPoolExecutor) to:
        1. Compute all legs in parallel (not sequentially)
        2. Keep the UI responsive during computation
        3. Leverage cached results from IGNClient's LRU cache
        """
        if len(stages) < 2:
            return

        # --- HÉRITAGE DES ÉPREUVES ---
        old_steps = self.state_manager.get_state("polygonal_steps", [])
        assignments = self.state_manager.get_state("custom_assignments", {})
        self._preserved_modules = []
        for i in range(len(old_steps)):
            chall = assignments.get(str(i), "unassigned")
            if chall != "unassigned":
                self._preserved_modules.append(chall)

        self.statusBar().showMessage("Calcul de l'itinéraire (parallèle)...")
        self.map_view.show_loading("Calcul parallèle des étapes...")

        # Cancel any running worker - STORE IT in a list so it doesn't get garbage collected and crash
        if not hasattr(self, '_old_route_workers'):
            self._old_route_workers = []
            
        if hasattr(self, '_route_worker') and self._route_worker is not None:
            if self._route_worker.isRunning():
                self._old_route_workers.append(self._route_worker)
                self._route_worker.cancel()
                try:
                    self._route_worker.route_calculated.disconnect()
                    self._route_worker.progress_update.disconnect()
                    self._route_worker.calculation_error.disconnect()
                except Exception:
                    pass
                
        # Clean up finished old workers
        self._old_route_workers = [w for w in self._old_route_workers if w.isRunning()]

        small_roads = False
        if hasattr(self, 'route_panel') and hasattr(self.route_panel, 'cb_small_roads'):
            small_roads = self.route_panel.cb_small_roads.isChecked()

        self._route_worker = _RouteCalculationWorker(
            stages, self.ign_client, self._leg_choices,
            small_roads_only=small_roads
        )
        self._route_worker.route_calculated.connect(self._on_parallel_route_done)
        self._route_worker.progress_update.connect(
            lambda msg: self.statusBar().showMessage(msg, 2000)
        )
        self._route_worker.calculation_error.connect(
            lambda err: (
                self.map_view.hide_loading(),
                self.statusBar().showMessage(f"Erreur de calcul : {err}", 4000)
            )
        )
        self._route_worker.start()

    def _on_parallel_route_done(self, stages, leg_routes, all_coords):
        """Callback when the parallel route worker finishes."""
        self.map_view.hide_loading()

        if not all_coords:
            self.statusBar().showMessage("Aucun itinéraire trouvé", 3000)
            return

        # Stage snapping removed to preserve user's original coordinates 
        # and prevent breaking the leg_key caching mechanism for azimuts.

        # Clear and rebuild routes
        from utils.route_engine import create_route
        routes_state = self.state_manager.get_state("routes", [])
        routes_state.clear()
        self.state_manager.update_state("routes", routes_state)

        fallback_warnings = []
        max_danger_level = None
        danger_scores = {"extreme": 3, "high": 2, "minor": 1}
        
        for idx, (leg_name, leg_key, leg_geom) in enumerate(leg_routes):
            new_route = create_route(leg_name, leg_geom)
            new_route["leg_key"] = leg_key
            new_route["order"] = len(routes_state)
            routes_state.append(new_route)
            
            # Ne vérifier le danger QUE sur la toute dernière étape calculée (le dernier tronçon)
            if idx == len(leg_routes) - 1:
                props = leg_geom.get("properties", {})
                if props.get("is_fallback", False):
                    dl = props.get("danger_level", "minor")
                    if dl in ("extreme", "high", "minor", "motorway_cross"):
                        fallback_warnings.append(leg_name)
                        max_danger_level = dl

        self.state_manager.update_state("routes", routes_state)
        
        # Determine the active chain for geometry builder
        if routes_state:
            self.state_manager.update_state("active_route_id", routes_state[-1]["id"])
        chain = [r["id"] for r in routes_state if r.get("visible", True)]
        self.state_manager.update_state("route_chain", chain)

        merged_geojson = {
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "geometry": {"type": "LineString", "coordinates": all_coords},
                "properties": {}
            }]
        }
        self.state_manager.update_state("geojson_data", merged_geojson)

        # --- INCREMENTAL AZIMUTS ---
        self.statusBar().showMessage(f"Itinéraire dessiné. Calcul incrémental des azimuts...", 4000)
        
        settings = self.state_manager.get_state("polygonalization_settings", {})
        force_inter = self.chk_intersections.isChecked() if hasattr(self, 'chk_intersections') else True
        if hasattr(self, 'tools_panel'):
            force_inter = self.tools_panel.chk_intersections.isChecked()
            
        polygonal_legs = self.state_manager.get_state("polygonal_legs", {})
        pending_legs = self.state_manager.get_state("pending_azimut_legs", [])
        
        # Determine exactly which legs require calculation
        for idx, (leg_name, leg_key, leg_geom) in enumerate(leg_routes):
            if leg_key not in polygonal_legs and leg_key not in pending_legs:
                pending_legs.append(leg_key)
                feature_collection = {
                    "type": "FeatureCollection",
                    "features": [{
                        "type": "Feature",
                        "geometry": leg_geom,
                        "properties": {"leg_index": idx, "leg_key": leg_key}
                    }]
                }
                self.bg_engine.enqueue_azimut_leg(f"azimut_{leg_key}", feature_collection, force_inter, settings)
                
        self.state_manager.update_state("pending_azimut_legs", pending_legs)
            
        self._assemble_polygonal_steps(leg_routes)

        stage_labels = " → ".join(s["label"] for s in stages)
        
        if fallback_warnings:
            if max_danger_level == "extreme":
                warn_msg = f"⚠ Point de vigilance ({', '.join(fallback_warnings)}) : Trajet le long d'une autoroute."
            elif max_danger_level == "motorway_cross":
                warn_msg = f"ℹ Information ({', '.join(fallback_warnings)}) : Passage sous ou sur une autoroute détecté."
            elif max_danger_level == "high":
                warn_msg = f"⚠ Point de vigilance ({', '.join(fallback_warnings)}) : Trajet prolongé sur route nationale."
            else:
                warn_msg = f"ℹ Information ({', '.join(fallback_warnings)}) : Section longue sur route départementale."

            self.statusBar().showMessage(warn_msg, 8000)
            self.map_view.show_status_message(warn_msg, "warning")
        else:
            self.statusBar().showMessage(f"Itinéraire {stage_labels} calculé ✓", 3000)
        
        # Refresh the map markers and UI lists so they visually update (e.g. after inversion)
        self._refresh_stages()
        self._sync_route_panel_with_stages()

    # ═══════════════════════════════════════════════════════
    # ROUTES
    # ═══════════════════════════════════════════════════════
    
    def _on_stages_reordered(self, new_stages):
        """Called when stages are drag-and-dropped in the route panel."""
        self.state_manager.push_to_history()
        # Recalculate legs according to the new permutation
        self._calculate_route_for_stages(new_stages)

    def on_danger_validated(self, route_idx):
        self.state_manager.push_to_history()
        routes = list(self.state_manager.get_state("routes", []))
        if 0 <= route_idx < len(routes):
            new_r = dict(routes[route_idx])
            new_r["danger_validated"] = True
            routes[route_idx] = new_r
            self.state_manager.update_state("routes", routes)
            self.delayed_map_update()
            self.statusBar().showMessage(f"Danger de l'étape {route_idx+1} vérifié et acquitté", 3000)

    def on_routes_changed(self):
        """Called when the route list changes — re-analyze for segmentation."""
        geojson = self.state_manager.get_state("geojson_data")
        if geojson and geojson.get("features"):
            # Auto re-run segmentation analysis via background engine
            self.tools_panel.analysis_cache = {"points": [], "indices": [], "instr_count": 0}
            
            settings = self.state_manager.get_state("polygonalization_settings", {})
            force_inter = True
            if hasattr(self, 'tools_panel') and hasattr(self.tools_panel, 'chk_intersections'):
                force_inter = self.tools_panel.chk_intersections.isChecked()
                
            if hasattr(self, 'bg_engine'):
                self.bg_engine.enqueue_azimut_leg("global_azimut_manual", geojson, force_inter, settings)
        
        # Auto-assign A/B from route endpoints if no stages exist
        self._auto_assign_stages_from_routes()
    
    def on_reset_itinerary(self):
        self._route_click_count = 0
        self.map_view.web_view.page().runJavaScript("if(tempMarkerLayer) tempMarkerLayer.clearLayers();")
        self.statusBar().showMessage("Marqueurs effacés", 2000)

    def on_ign_route_with_points(self, profile, points_json, server_url=""):
        """Route calculation from map markers (legacy bridge support)."""
        try:
            points = json.loads(points_json)
            if not points or len(points) < 2:
                return

            p1, p2 = points[0], points[1]
            self.statusBar().showMessage(f"Calcul de l'itinéraire ({profile})...")
            
            geometry = self.ign_client.compute_route(p1, p2, profile)
            
            if geometry:
                from utils.route_engine import create_route
                new_route = create_route(f"Itinéraire carte", geometry)
                self.route_panel._add_route_to_state(new_route)
                self.statusBar().showMessage("Itinéraire créé", 2000)
            else:
                geometry = {
                    "type": "LineString",
                    "coordinates": [[p1[1], p1[0]], [p2[1], p2[0]]]
                }
                from utils.route_engine import create_route
                new_route = create_route("Ligne droite", geometry)
                self.route_panel._add_route_to_state(new_route)
                
                self.map_view.web_view.page().runJavaScript("stopLoading();")
                self.statusBar().showMessage("Mode hors-piste : ligne droite", 4000)
                
        except Exception as e:
            self.logger.error(f"Routing Error: {e}")
            self.map_view.web_view.page().runJavaScript("stopLoading();")
            self.statusBar().showMessage(f"Erreur de tracé : {e}", 3000)

    # ═══════════════════════════════════════════════════════
    # SEARCH
    # ═══════════════════════════════════════════════════════
    
    def on_map_search_autocomplete(self, query):
        if not query or len(query) < 3: return
        response = self.ign_client.search_address(query, limit=5)
        # Handle structured response
        if isinstance(response, dict):
            results = response.get("results", [])
            error = response.get("error")
            if error and not results:
                self.statusBar().showMessage(
                    {"timeout": "Géocodage : serveur lent, réessayez",
                     "network_error": "Géocodage : pas de connexion",
                     "bad_request": "Géocodage : requête invalide"
                    }.get(error, f"Géocodage : {error}"), 4000
                )
        else:
            results = response  # Legacy list format
        self.map_view.show_search_suggestions(results)

    # ═══════════════════════════════════════════════════════
    # SEGMENT OPERATIONS
    # ═══════════════════════════════════════════════════════
    
    def on_azimut_manually_updated(self, idx, new_azi):
        steps = self.state_manager.get_state("polygonal_steps", [])
        if 0 <= idx < len(steps):
            self.state_manager.push_to_history()
            if "properties" in steps[idx]:
                steps[idx]["properties"]["azimut"] = new_azi
            else:
                steps[idx]["azimut"] = new_azi
            self.state_manager.update_state("polygonal_steps", steps)
            self.statusBar().showMessage(f"Azimut du segment {idx+1} : {new_azi}°", 3000)

    def on_segments_merged(self, idx):
        steps = self.state_manager.get_state("polygonal_steps", [])
        if idx <= 0 or idx >= len(steps): return
        
        node_idx = steps[idx-1].get("properties", {}).get("point_idx")
        if node_idx is None: return
        
        masked = list(self.state_manager.get_state("masked_nodes", []))
        if node_idx not in masked:
            old_assignments = self.get_assignments_with_metadata()
            masked.append(node_idx)
            self.state_manager.update_state("masked_nodes", masked, record_history=True)
            self.tools_panel.run_fast_polygonalization()
            self.reproject_assignments(old_assignments)
            self.statusBar().showMessage(f"Nœud {idx} supprimé", 3000)

    def on_node_added(self, lat, lng, segment_idx):
        if self.state_manager.get_state("active_tool") != "node": return
        
        steps = self.state_manager.get_state("polygonal_steps", [])
        if not (0 <= segment_idx < len(steps)): return
        
        start_p = steps[segment_idx]["properties"]["start_idx"]
        end_p = steps[segment_idx]["properties"]["point_idx"]
        
        import refactor_polygonalisation
        geojson = self.state_manager.get_state("geojson_data")
        all_points = refactor_polygonalisation.get_all_points_from_geojson(geojson)
        if not all_points: return
        
        best_idx = -1
        min_d = float('inf')
        safe_end = min(end_p, len(all_points) - 1)
        
        for i in range(start_p + 1, safe_end):
            d = refactor_polygonalisation.calculate_distance([lng, lat], all_points[i])
            if d < min_d:
                min_d = d
                best_idx = i
        
        if best_idx != -1:
            self.state_manager.push_to_history()
            old_assignments = self.get_assignments_with_metadata()
            forced = list(self.state_manager.get_state("forced_nodes", []))
            if best_idx not in forced:
                forced.append(best_idx)
                masked = list(self.state_manager.get_state("masked_nodes", []))
                if best_idx in masked: masked.remove(best_idx)
                
                self.state_manager.update_state("forced_nodes", forced)
                self.state_manager.update_state("masked_nodes", masked)
                
                self.tools_panel.run_fast_polygonalization()
                self.reproject_assignments(old_assignments)
                self.statusBar().showMessage(f"Nœud ajouté à l'index {best_idx}", 3000)

    def on_node_removed(self, point_idx):
        if self.state_manager.get_state("active_tool") != "node": return
        
        self.state_manager.push_to_history()
        old_assignments = self.get_assignments_with_metadata()
        
        masked = list(self.state_manager.get_state("masked_nodes", []))
        if point_idx not in masked:
            masked.append(point_idx)
            
        forced = list(self.state_manager.get_state("forced_nodes", []))
        if point_idx in forced:
            forced.remove(point_idx)
            
        self.state_manager.update_state("masked_nodes", masked)
        self.state_manager.update_state("forced_nodes", forced)
        
        self.tools_panel.run_fast_polygonalization()
        self.reproject_assignments(old_assignments)
        self.statusBar().showMessage(f"Nœud {point_idx} masqué", 3000)

    def on_node_moved(self, point_idx, lat, lng):
        if self.state_manager.get_state("active_tool") != "node": return
        
        import refactor_polygonalisation
        geojson = self.state_manager.get_state("geojson_data")
        all_points = refactor_polygonalisation.get_all_points_from_geojson(geojson)
        if not all_points: return
        
        # Find closest point in all_points
        best_idx = -1
        min_d = float('inf')
        for i, pt in enumerate(all_points):
            d = refactor_polygonalisation.calculate_distance([lng, lat], pt)
            if d < min_d:
                min_d = d
                best_idx = i
                
        if best_idx != -1 and best_idx != point_idx:
            self.state_manager.push_to_history()
            old_assignments = self.get_assignments_with_metadata()
            
            forced = list(self.state_manager.get_state("forced_nodes", []))
            if point_idx in forced: forced.remove(point_idx)
            if best_idx not in forced: forced.append(best_idx)
            self.state_manager.update_state("forced_nodes", forced)
            
            masked = list(self.state_manager.get_state("masked_nodes", []))
            if best_idx in masked: masked.remove(best_idx)
            self.state_manager.update_state("masked_nodes", masked)
            
            self.tools_panel.run_fast_polygonalization()
            self.reproject_assignments(old_assignments)
            self.statusBar().showMessage(f"Nœud déplacé (index {best_idx})", 3000)

    def on_method_dropped(self, method_id, segment_idx):
        self.state_manager.push_to_history()
        manual = self.state_manager.get_state("custom_assignments", {})
        manual[str(segment_idx)] = method_id
        self.state_manager.update_state("custom_assignments", manual)
        self.statusBar().showMessage(f"{method_id.upper()} assigné au segment {segment_idx+1}", 3000)
        self.delayed_map_update()

    def on_batch_assign(self, method_id, json_list_str):
        self.state_manager.push_to_history()
        try:
            indices = json.loads(json_list_str)
            manual = self.state_manager.get_state("custom_assignments", {})
            for idx in indices:
                manual[str(idx)] = method_id
            self.state_manager.update_state("custom_assignments", manual)
            self.statusBar().showMessage(f"{method_id.upper()} assigné à {len(indices)} segment(s)", 3000)
            self.delayed_map_update()
        except Exception as e:
            self.logger.error(f"Error in batch assign: {e}")

    def on_basemap_changed(self, layer_name):
        self.state_manager.update_state("active_ign_layer", layer_name)
        self.statusBar().showMessage(f"Fond de carte : {layer_name}", 2000)

    def on_segment_menu(self, segment_idx, lat, lng):
        from PySide6.QtWidgets import QMenu
        menu = QMenu(self)
        menu.addAction(f"Segment #{segment_idx+1}").setEnabled(False)
        menu.addSeparator()
        
        for m in ["carte_ign", "drapeaux", "morse", "texte_clair", "gilwell"]:
            act = menu.addAction(f"Assigner {m.upper()}")
            act.triggered.connect(lambda chk=False, mod=m: self.on_method_dropped(mod, segment_idx))
            
        menu.exec(self.map_view.mapToGlobal(self.map_view.rect().center())) 

    def on_node_menu(self, node_idx, lat, lng):
        from PySide6.QtWidgets import QMenu
        menu = QMenu(self)
        menu.addAction(f"Nœud {node_idx}").setEnabled(False)
        menu.addSeparator()
        
        if node_idx > 0:
            act = menu.addAction("Supprimer ce nœud")
            act.triggered.connect(lambda: self.on_segments_merged(node_idx))
        else:
            menu.addAction("Début du tracé").setEnabled(False)
            
        menu.exec(self.map_view.mapToGlobal(self.map_view.rect().center()))

    def get_assignments_with_metadata(self):
        steps = self.state_manager.get_state("polygonal_steps", [])
        manual = self.state_manager.get_state("custom_assignments", {})
        results = []
        for i_str, mod in manual.items():
            if mod == "unassigned": continue
            idx = int(i_str)
            if idx < len(steps):
                props = steps[idx].get("properties", {})
                results.append({
                    "start": props.get("start_idx"),
                    "end": props.get("point_idx"),
                    "module": mod
                })
        return results

    def reproject_assignments(self, old_data):
        new_steps = self.state_manager.get_state("polygonal_steps", [])
        new_manual = {}
        for i, step in enumerate(new_steps):
            s_new = step["properties"].get("start_idx", 0)
            e_new = step["properties"].get("point_idx", 0)
            best_mod = "unassigned"
            for old in old_data:
                if (old["start"] >= s_new and old["end"] <= e_new) or \
                   (s_new >= old["start"] and e_new <= old["end"]):
                    best_mod = old["module"]
                    break
            if best_mod != "unassigned":
                new_manual[str(i)] = best_mod
        self.state_manager.update_state("custom_assignments", new_manual)

    # ═══════════════════════════════════════════════════════
    # PROJECT MANAGEMENT
    # ═══════════════════════════════════════════════════════
    
    def on_new_project(self):
        res = QMessageBox.question(self, "Nouveau Projet", 
            "Réinitialiser le projet actuel ?", QMessageBox.Yes | QMessageBox.No)
        if res == QMessageBox.Yes:
            self.state_manager.new_project()
            self.refresh_ui()
            self.statusBar().showMessage("Nouveau projet créé", 3000)

    def on_open_project(self):
        path, _ = QFileDialog.getOpenFileName(self, "Ouvrir Projet Scout", "", "Projet Scout (*.scoutproj)")
        if path:
            try:
                self.state_manager.load_project(path)
                self.refresh_ui()
                self.statusBar().showMessage(f"Chargé : {os.path.basename(path)}", 3000)
                
                # Feature 7: Auto-recalculate missing segmentation
                steps = self.state_manager.get_state("polygonal_steps", [])
                routes = self.state_manager.get_state("routes", [])
                if routes and not steps:
                    self.tools_panel.run_polygonalization()
            except Exception as e:
                QMessageBox.critical(self, "Erreur", f"Échec du chargement : {e}")

    def on_save_project(self):
        if self.state_manager.current_filepath:
            self.state_manager.save_project()
            self.statusBar().showMessage("Enregistré", 3000)
        else:
            self.on_save_project_as()

    def on_save_project_as(self):
        path, _ = QFileDialog.getSaveFileName(self, "Enregistrer Projet Scout", "", "Projet Scout (*.scoutproj)")
        if path:
            if not path.endswith(".scoutproj"):
                path += ".scoutproj"
            self.state_manager.save_project(path)
            self.statusBar().showMessage(f"Enregistré : {os.path.basename(path)}", 3000)

    # ═══════════════════════════════════════════════════════
    # UI REFRESH & RENDERING
    # ═══════════════════════════════════════════════════════
    
    def refresh_ui(self):
        """Full UI refresh from state."""
        self.tools_panel.refresh_from_state()
        self.route_panel.refresh_from_state()
        self.difficulty_panel.refresh_from_state()
        self.theme_panel.refresh_from_state()
        self.delayed_map_update(fit_bounds=True)

    def on_poly_updated(self):
        """Triggered when segmentation parameters change or async calculation finishes."""
        new_steps = self.state_manager.get_state("polygonal_steps", [])
        preserved = getattr(self, '_preserved_modules', [])
        new_assignments = {}
        for i in range(len(new_steps)):
            if i < len(preserved):
                new_assignments[str(i)] = preserved[i]
            else:
                new_assignments[str(i)] = "unassigned"
        self.state_manager.update_state("custom_assignments", new_assignments)
        
        self.delayed_map_update(fit_bounds=False)
        self.statusBar().showMessage(f"✓ Azimuts mis à jour ({len(new_steps)} segments)", 3000)

    def delayed_map_update(self, fit_bounds=False):
        """Update segments on map with validation highlights. Delayed to ensure state consistency."""
        geojson  = self.state_manager.get_state("geojson_data")
        segments = self.state_manager.get_state("polygonal_steps", [])
        manual   = self.state_manager.get_state("custom_assignments", {})
        
        if not segments:
            if geojson:
                self.map_view.render_geojson(geojson)
            return

        # Calculate violations for map highlights
        violations = {}
        v_list = self.validator.validate(segments, manual, self.presets_manager)
        for v in v_list:
            idx = v.get("seg_idx")
            if idx is not None and idx != -1:
                if idx not in violations or v["level"] == "error":
                    violations[idx] = v

        # Génération des POIs de danger interactifs et discrets
        danger_pois = []
        routes = self.state_manager.get_state("routes", [])
        for r_idx, r in enumerate(routes):
            if r.get("danger_validated", False):
                continue
                
            geom = r.get("geojson", {})
            props = geom.get("properties", {})
            dl = props.get("danger_level")
            
            if dl in ("extreme", "high", "minor"):  # motorway_cross est traité via une notif éphémère d'info
                d_coord = props.get("danger_coord")
                if not d_coord:
                    coords = geom.get("coordinates", [])
                    if coords:
                        d_coord = coords[len(coords) // 2]
                
                if d_coord:
                    danger_pois.append({
                        "route_idx": r_idx,
                        "lat": d_coord[1],
                        "lon": d_coord[0],
                        "level": dl
                    })

        self.map_view.render_segments(
            segments, 
            manual, 
            violations=violations, 
            fit_bounds=fit_bounds,
            geojson=geojson,
            danger_pois=danger_pois
        )

    # ═══════════════════════════════════════════════════════
    # EXPORT
    # ═══════════════════════════════════════════════════════
    
    def run_export_pipeline(self):
        # 1. Validation de base (données présentes)
        geojson = self.state_manager.get_state("geojson_data")
        steps = self.state_manager.get_state("polygonal_steps", [])
        if not geojson and not steps:
            QMessageBox.warning(self, "Aucune donnée",
                "Aucun itinéraire chargé.\nImportez ou tracez un itinéraire avant d'exporter.")
            return

        # 2. Validation pédagogique (ConstraintValidator)
        manual = self.state_manager.get_state("custom_assignments", {})
        violations = self.validator.validate(steps, manual, self.presets_manager)
        
        if violations:
            dialog = ExportWarningDialog(violations, self)
            if dialog.exec() == QDialog.Rejected:
                return # User cancelled

        # 3. Demander le dossier de sauvegarde
        save_dir = QFileDialog.getExistingDirectory(self, "Choisir le dossier d'exportation", PROJECT_ROOT)
        if not save_dir:
            return # User cancelled

        # 4. Lancement de l'export
        self._export_progress_dialog = ExportProgressDialog(self)
        self._export_progress_dialog.show()

        self._export_worker = _ExportWorker(self.state_manager, output_dir=save_dir)
        self._export_worker.export_done.connect(self._on_export_finished)
        self._export_worker.progress_update.connect(self._on_export_progress)
        self._export_worker.start()

    def _on_export_progress(self, msg, percentage):
        if hasattr(self, '_export_progress_dialog'):
            self._export_progress_dialog.log(msg, percentage)

    def _on_export_finished(self, success, error_msg, pdf_participant, pdf_solution):
        if hasattr(self, '_export_progress_dialog'):
            if success:
                self._export_progress_dialog.log("Génération terminée avec succès !", 100)
                self._export_progress_dialog.close_btn.setEnabled(True)
                self._export_progress_dialog.close_btn.setStyleSheet("background-color: #2e7d32; color: white; font-weight: bold;")
            else:
                self._export_progress_dialog.log(f"ERREUR : {error_msg}", -1)
                self._export_progress_dialog.close_btn.setEnabled(True)
                self._export_progress_dialog.close_btn.setText("Fermer (Erreur)")

        if not success:
            QMessageBox.critical(self, "Erreur d'export",
                f"La génération a échoué :\n\n{error_msg}")
            self.statusBar().showMessage("Export échoué", 4000)
            return

        self.statusBar().showMessage("Export terminé ✓", 4000)

        from ui.workspace.export_preview import ExportPreviewDialog
        dlg = ExportPreviewDialog(pdf_participant, pdf_solution, parent=self)
        dlg.exec()


    # ═══════════════════════════════════════════════════════
    # WORKSPACE MANAGEMENT
    # ═══════════════════════════════════════════════════════
    
    def _apply_workspace(self, preset_id):
        """Apply a built-in workspace layout preset."""
        if preset_id == "complet":
            # All docks visible
            for d in [self.dock_route, self.dock_segmentation, self.dock_modules, self.dock_difficulty]:
                d.setVisible(True)
            self.dock_route.raise_()
            self.dock_modules.raise_()
            self.statusBar().showMessage("Disposition : Complet", 2000)
            
        elif preset_id == "carte_seule":
            # Hide all docks, maximise map
            for d in [self.dock_route, self.dock_segmentation, self.dock_modules, self.dock_difficulty]:
                d.setVisible(False)
            self.statusBar().showMessage("Disposition : Carte seule", 2000)
            
        elif preset_id == "creation":
            # Only route + segmentation visible on the left
            self.dock_route.setVisible(True)
            self.dock_segmentation.setVisible(True)
            self.dock_modules.setVisible(False)
            self.dock_difficulty.setVisible(False)
            self.dock_route.raise_()
            self.statusBar().showMessage("Disposition : Création d'itinéraire", 2000)
            
        elif preset_id == "export":
            # Only difficulty + challenges visible
            self.dock_route.setVisible(False)
            self.dock_segmentation.setVisible(False)
            self.dock_modules.setVisible(True)
            self.dock_difficulty.setVisible(True)
            self.dock_difficulty.raise_()
            self.statusBar().showMessage("Disposition : Export", 2000)
        else:
            # Custom workspace — restore from QSettings
            settings = QSettings("ScoutDesignSuite", "Workspace")
            state = settings.value(f"custom_ws/{preset_id}/state")
            geom = settings.value(f"custom_ws/{preset_id}/geometry")
            if state:
                self.restoreState(QByteArray(state))
            if geom:
                self.restoreGeometry(QByteArray(geom))
            self.statusBar().showMessage(f"Disposition : {preset_id}", 2000)
    
    def _save_custom_workspace(self):
        """Save the current dock layout as a named custom workspace."""
        name, ok = QInputDialog.getText(self, "Enregistrer la disposition",
            "Nom de la disposition :")
        if not ok or not name:
            return
        
        settings = QSettings("ScoutDesignSuite", "Workspace")
        settings.setValue(f"custom_ws/{name}/state", self.saveState())
        settings.setValue(f"custom_ws/{name}/geometry", self.saveGeometry())
        
        # Update list of custom workspace names
        names = settings.value("custom_ws_names", [])
        if not isinstance(names, list):
            names = []
        if name not in names:
            names.append(name)
        settings.setValue("custom_ws_names", names)
        
        self._rebuild_custom_ws_menu()
        self.statusBar().showMessage(f"Disposition « {name} » enregistrée", 3000)
    
    def _rebuild_custom_ws_menu(self):
        """Rebuild custom workspace entries in the menu."""
        settings = QSettings("ScoutDesignSuite", "Workspace")
        names = settings.value("custom_ws_names", [])
        if not isinstance(names, list):
            names = []
        
        # Remove old custom actions (tagged with _custom_ws_actions)
        if hasattr(self, '_custom_ws_actions'):
            for act in self._custom_ws_actions:
                self._ws_menu.removeAction(act)
        self._custom_ws_actions = []
        
        # Find the separator before "Enregistrer" and insert custom entries before it
        for ws_name in names:
            act = QAction(f"★ {ws_name}", self)
            act.triggered.connect(lambda chk=False, n=ws_name: self._apply_workspace(n))
            # Insert before the last separator
            actions = self._ws_menu.actions()
            if len(actions) >= 2:
                self._ws_menu.insertAction(actions[-2], act)
            else:
                self._ws_menu.addAction(act)
            self._custom_ws_actions.append(act)
    
    def closeEvent(self, event):
        """Save window geometry and dock state on exit."""
        settings = QSettings("ScoutDesignSuite", "Workspace")
        settings.setValue("last_state", self.saveState())
        settings.setValue("last_geometry", self.saveGeometry())
        
        # Clean up background threads to prevent fatal QThread destroyed errors
        if hasattr(self, '_route_worker') and self._route_worker and self._route_worker.isRunning():
            self._route_worker.cancel()
            self._route_worker.wait(1000)
            
        if hasattr(self, '_old_route_workers'):
            for w in self._old_route_workers:
                if w.isRunning():
                    w.cancel()
                    w.wait(500)
                    
        if hasattr(self, 'bg_engine') and self.bg_engine:
            self.bg_engine.stop()
            self.bg_engine.wait(2000)
            
        super().closeEvent(event)
    
    def _restore_last_workspace(self):
        """Restore the last used workspace layout."""
        settings = QSettings("ScoutDesignSuite", "Workspace")
        state = settings.value("last_state")
        geom = settings.value("last_geometry")
        if state:
            self.restoreState(QByteArray(state))
        if geom:
            self.restoreGeometry(QByteArray(geom))

    # ═══════════════════════════════════════════════════════
    # ROUTE ALTERNATIVES & OVERLAP
    # ═══════════════════════════════════════════════════════

    def _check_overlap(self, new_coords, existing_coords=None):
        """Returns True if the new route overlaps existing_coords.
        Uses _SpatialGrid for O(n) instead of O(n*m)."""
        total_points = len(new_coords)
        if total_points == 0:
            return False

        if not existing_coords:
            return False

        grid = _SpatialGrid(cell_size=0.0003)  # ~30m cells
        grid.insert_points(existing_coords)
        overlap_count = grid.count_nearby(new_coords)

        return (overlap_count / total_points) > 0.15  # 15% overlap threshold

    def _filter_distinct_alternatives(self, alts):
        """Remove alternatives that are too similar (>80% overlap).
        Uses _SpatialGrid for O(n) per comparison."""
        if not alts:
            return []
        distinct = [alts[0]]  # Always keep the first one

        for i in range(1, len(alts)):
            cand = alts[i]
            cand_coords = cand["geometry"]["coordinates"]
            is_redundant = False

            for kept in distinct:
                kept_coords = kept["geometry"]["coordinates"]
                grid = _SpatialGrid(cell_size=0.0003)
                grid.insert_points(kept_coords)
                overlap_count = grid.count_nearby(cand_coords)

                if len(cand_coords) > 0 and (overlap_count / len(cand_coords)) > 0.8:
                    is_redundant = True
                    break

            if not is_redundant:
                distinct.append(cand)

        return distinct

    def _enter_route_selection_mode(self, alternatives):
        """Enter a modal-like mode where tools are disabled during selection."""
        self._route_selection_mode = True
        self.set_ui_blocked(True)
        self.map_view.show_route_alternatives(alternatives)
        self.statusBar().showMessage("⚠ Chevauchement — Cliquez sur une option (1, 2 ou 3) sur la carte")

    def on_route_alternative_selected(self, idx):
        """Callback from JS when an alternative is clicked."""
        if not self._route_selection_mode or idx >= len(self._pending_alternatives):
            return
            
        self.state_manager.push_to_history()
        alt = self._pending_alternatives[idx]
        
        # PERSIST CHOICE
        i = self._pending_leg_idx
        s = self._pending_stages
        leg_key = f"{round(s[i]['lat'],6)}_{round(s[i]['lon'],6)}_{round(s[i+1]['lat'],6)}_{round(s[i+1]['lon'],6)}"
        self._leg_choices[leg_key] = alt["geometry"]["coordinates"]
        
        self._route_selection_mode = False
        self.set_ui_blocked(False)
        self.map_view.clear_route_alternatives()
        
        # Resume calculation
        self._calculate_route_for_stages(self._pending_stages)

    def set_ui_blocked(self, locked):
        """Disable/Enable all main UI panels to enforce a modal choice."""
        panels = [
            self.tools_panel, 
            self.difficulty_panel, 
            self.route_panel, 
            getattr(self, 'inspector_panel', None),
            getattr(self, 'library_dock', None)
        ]
        for p in panels:
            if p: p.setEnabled(not locked)
        self.menuBar().setEnabled(not locked)

    def on_ign_route_with_points(self, profile, json_points, server_url):
        self.map_view.show_loading("Calcul d'itinéraire groupé...")
        # (Remaining logic is handled by existing code if any, if not we just hide after timeout)
        QTimer.singleShot(1500, self.map_view.hide_loading)


if __name__ == "__main__":
    app = QApplication(sys.argv)
    window = ScoutWorkspace()
    window._restore_last_workspace()
    window.show()
    sys.exit(app.exec())


