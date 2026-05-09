import json
import os
import zipfile
import tempfile
import shutil
from PySide6.QtCore import QObject, Signal

class StateManager(QObject):
    """
    Gestionnaire d'état de l'application Scout Carnet Generator.
    Sauvegarde et charge l'état de l'application dans un fichier .scoutproj.
    Supporte l'historique (Undo/Redo).
    """
    state_changed = Signal(str, object) # key, new_value (or "all")

    def __init__(self):
        super().__init__()
        self.reset_state()
        self.current_filepath = None

    def reset_state(self):
        """Initialisation ou réinitialisation des données du projet."""
        self.current_state = {
            "version": "2.0",
            # Multi-route model
            "routes": [],                  # List of route dicts (see route_engine.py)
            "active_route_id": None,       # ID of the currently selected route
            "route_chain": [],             # Ordered list of route IDs for export
            # Legacy compat — computed from routes when needed
            "geojson_data": None,
            "polygonalization_settings": {
                "tolerance": 45,
                "allow_offroad": False,
                "force_intersections": True,
                "min_dist": 80,
                "bypassed": False
            },
            "polygonal_steps": [],
            "distribution_mode": "auto", 
            "active_preset_id": "default",
            "custom_assignments": {}, 
            "masked_nodes": [],
            "forced_nodes": [],
            "active_tool": "route",
            "stages": [],  # [{"lat": ..., "lon": ..., "label": "A"}, ...]
            "theme_id": "Neutre",
            "theme_overrides": {},
            "show_azimuth_arrows": True,
            "active_ign_layer": "GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2",
            "small_roads_only": True,
            "polygonal_legs": {},
            "pending_azimut_legs": []
        }
        self.undo_stack = []
        self.redo_stack = []

    def update_state(self, key, value, record_history=False):
        """
        Updates a specific state key and emits an event to notify the UI.
        
        Args:
            key (str): The state property to update (e.g., 'polygonal_steps').
            value (any): The new value.
            record_history (bool): If True, saves the current state to the undo stack before overwriting.
        """
        if record_history:
            self.push_to_history()
        self.current_state[key] = value
        self.state_changed.emit(key, value)

    def get_state(self, key, default=None):
        """
        Retrieves a state property.
        
        Args:
            key (str): The state property to retrieve.
            default (any): Fallback value if the key does not exist.
            
        Returns:
            The value of the state property or the default.
        """
        return self.current_state.get(key, default)

    # --- History (Undo/Redo) ---
    def _create_snapshot(self):
        """Creates a deep copy of the critical projet state."""
        return {
            "polygonal_steps": json.loads(json.dumps(self.current_state.get("polygonal_steps", []))),
            "custom_assignments": json.loads(json.dumps(self.current_state.get("custom_assignments", {}))),
            "masked_nodes": json.loads(json.dumps(self.current_state.get("masked_nodes", []))),
            "forced_nodes": json.loads(json.dumps(self.current_state.get("forced_nodes", []))),
            "active_tool": self.current_state.get("active_tool", "route"),
            "polygonalization_settings": json.loads(json.dumps(self.current_state.get("polygonalization_settings", {}))),
            "stages": json.loads(json.dumps(self.current_state.get("stages", []))),
            "routes": json.loads(json.dumps(self.current_state.get("routes", []))),
            "route_chain": json.loads(json.dumps(self.current_state.get("route_chain", []))),
            "active_route_id": self.current_state.get("active_route_id"),
            "geojson_data": json.loads(json.dumps(self.current_state.get("geojson_data"))),
            "small_roads_only": self.current_state.get("small_roads_only", True),
            "polygonal_legs": json.loads(json.dumps(self.current_state.get("polygonal_legs", {}))),
            "pending_azimut_legs": json.loads(json.dumps(self.current_state.get("pending_azimut_legs", [])))
        }

    def push_to_history(self):
        """Saves current critical state to undo stack."""
        self.undo_stack.append(self._create_snapshot())
        if len(self.undo_stack) > 50: self.undo_stack.pop(0)
        self.redo_stack = [] 

    def undo(self):
        """Reverts the application state to the previous snapshot."""
        if not self.undo_stack: return
        self.redo_stack.append(self._create_snapshot())
        prev = self.undo_stack.pop()
        self.current_state.update(prev)
        self.state_changed.emit("all", self.current_state)

    def redo(self):
        """Reapplies a previously undone state snapshot."""
        if not self.redo_stack: return
        self.undo_stack.append(self._create_snapshot())
        nxt = self.redo_stack.pop()
        self.current_state.update(nxt)
        self.state_changed.emit("all", self.current_state)

    # --- Persistence ---
    def save_project(self, filepath=None):
        """
        Zips the current state into a .scoutproj file to save work-in-progress.
        
        Args:
            filepath (str, optional): Target destination. If None, overwrites current file.
        """
        if filepath: self.current_filepath = filepath
        if not self.current_filepath: return
        
        with tempfile.TemporaryDirectory() as tmpdirname:
            state_file = os.path.join(tmpdirname, "state.json")
            with open(state_file, 'w', encoding='utf-8') as f:
                json.dump(self.current_state, f, indent=4)
            with zipfile.ZipFile(self.current_filepath, 'w', zipfile.ZIP_DEFLATED) as zipf:
                zipf.write(state_file, arcname="state.json")

    def load_project(self, filepath):
        if not os.path.exists(filepath): return
        with tempfile.TemporaryDirectory() as tmpdirname:
            with zipfile.ZipFile(filepath, 'r') as zipf:
                zipf.extractall(tmpdirname)
            state_file = os.path.join(tmpdirname, "state.json")
            if os.path.exists(state_file):
                with open(state_file, 'r', encoding='utf-8') as f:
                    self.current_state = json.load(f)
                self.current_filepath = filepath
                self.state_changed.emit("all", self.current_state)

    def new_project(self):
        self.reset_state()
        self.current_filepath = None
        self.state_changed.emit("all", self.current_state)
