import os
import json

UTILS_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(UTILS_DIR)
PRESETS_FILE = os.path.join(PROJECT_ROOT, 'config', 'presets.json')

class PresetsManager:
    def __init__(self):
        self.presets_data = {}
        self.active_preset_id = None
        self.active_preset_data = {}
        self.load()

    def load(self):
        if not os.path.isfile(PRESETS_FILE):
            print(f"Warning: Presets file {PRESETS_FILE} not found. Using empty data.")
            self.presets_data = {"factory": {}, "custom": {}, "active_preset": None}
            return

        with open(PRESETS_FILE, 'r', encoding='utf-8') as f:
            self.presets_data = json.load(f)

        self.active_preset_id = self.presets_data.get('active_preset')
        self._resolve_active_preset()

    def _resolve_active_preset(self):
        if not self.active_preset_id:
            return

        # Chercher dans factory
        if self.active_preset_id in self.presets_data.get('factory', {}):
            self.active_preset_data = self.presets_data['factory'][self.active_preset_id]
        # Chercher dans custom
        elif self.active_preset_id in self.presets_data.get('custom', {}):
            self.active_preset_data = self.presets_data['custom'][self.active_preset_id]
        else:
            print(f"Warning: Preset '{self.active_preset_id}' introuvable.")
            self.active_preset_data = {}

    def get_polygonalisation_settings(self):
        if not self.active_preset_data:
            return {"tolerance_angle": 20, "hors_piste": False, "forcer_carrefours": True}
        return self.active_preset_data.get("polygonalisation", {
            "tolerance_angle": 20, "hors_piste": False, "forcer_carrefours": True
        })

    def get_weights(self):
        """Retourne le dictionnaire des poids du preset actif."""
        if not self.active_preset_data:
            return {}
        return self.active_preset_data.get("weights", {})

    def get_overrides(self, module_name):
        """Retourne le dict des surcharges de règles pour le module donné."""
        if not self.active_preset_data:
            return {}
        overrides = self.active_preset_data.get("overrides", {})
        return overrides.get(module_name, {})

    def apply_overrides_to_category(self, module_name, category_data):
        """
        Fusionne les données par défaut de l'archétype/catégorie avec
        les overrides du preset actif pour ce module.
        """
        mod_overrides = self.get_overrides(module_name)
        if not mod_overrides:
            return category_data
            
        merged = category_data.copy()
        for k, v in mod_overrides.items():
            merged[k] = v
        return merged

    def set_active_preset(self, preset_id):
        self.active_preset_id = preset_id
        self._resolve_active_preset()
        self.presets_data['active_preset'] = preset_id
        self.save()

    def save_custom_preset(self, preset_id, preset_data):
        if "custom" not in self.presets_data:
            self.presets_data["custom"] = {}
        self.presets_data["custom"][preset_id] = preset_data
        self.save()

    def remove_custom_preset(self, preset_id):
        if "custom" in self.presets_data and preset_id in self.presets_data["custom"]:
            del self.presets_data["custom"][preset_id]
            if self.active_preset_id == preset_id:
                # Fallback to default
                self.active_preset_id = "seconde_classe_1"
                self.presets_data["active_preset"] = self.active_preset_id
            self.save()

    def save(self):
        with open(PRESETS_FILE, 'w', encoding='utf-8') as f:
            json.dump(self.presets_data, f, indent=2, ensure_ascii=False)
