"""
Validation Helpers — Check itinerary constraints against orchestrator rules.
"""
import os
import json

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

class ConstraintValidator:
    """
    Vérifie les assignments manuels contre les règles de l'orchestrateur.
    """
    MODULE_CATEGORY = {
        "carte_ign": "ign_map", "drapeaux": "graphic", "gilwell": "graphic",
        "morse": "crypted_message", "templier": "crypted_message", "polybe": "crypted_message",
        "maritime": "graphic", "avocat": "crypted_message", "cassis": "crypted_message",
        "vigenere": "crypted_message", "texte_clair": "explicit_message", "azimut_pur": "crypted_message"
    }
    MODULE_TYPE = {
        "carte_ign": "visual", "drapeaux": "visual", "gilwell": "visual", "maritime": "visual",
        "morse": "written", "templier": "written", "polybe": "written", "avocat": "written",
        "cassis": "written", "vigenere": "written", "texte_clair": "written", "azimut_pur": "written"
    }

    def __init__(self):
        self.categories = {}
        self.enabled_modules = []
        self.explanations = {}
        self._load_configs()
        self._load_explanations()

    def _load_configs(self):
        path_cat = os.path.join(PROJECT_ROOT, "config", "constraints_categories.json")
        try:
            with open(path_cat, "r", encoding="utf-8") as f:
                self.categories = json.load(f).get("categories", {})
        except Exception: pass
        path_codes = os.path.join(PROJECT_ROOT, "config", "config_codes.json")
        try:
            with open(path_codes, "r", encoding="utf-8") as f:
                self.enabled_modules = json.load(f).get("enabled", [])
        except Exception: pass

    def _load_explanations(self):
        # Load rule explanations from module manifests
        modules_dir = os.path.join(PROJECT_ROOT, "modules")
        if not os.path.exists(modules_dir): return
        for mod_name in os.listdir(modules_dir):
            manifest_path = os.path.join(modules_dir, mod_name, "manifest.json")
            if os.path.exists(manifest_path):
                try:
                    with open(manifest_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        if "rules_explanation" in data:
                            self.explanations[mod_name] = data["rules_explanation"]
                except Exception: pass

    def validate(self, segments, assignments, presets_manager=None):
        violations = []
        n = len(segments)
        if n == 0: return violations
        
        # Extract assigned modules in order
        ordered = []
        for i in range(n):
            val = assignments.get(str(i))
            if val and val not in ("unassigned", "--- Ignorer ---"):
                ordered.append((i, val))

        if not ordered: return violations

        consecutive_written = 0
        last_type = None
        history = []
        occ_count = {}
        
        # Tracking for Gilwell sequences
        for idx, item in enumerate(ordered):
            i, mod = item
            
            # 1. Type / Rhythm
            mtype = self.MODULE_TYPE.get(mod, "written")
            if mtype == "written":
                consecutive_written += 1
                if consecutive_written > 3:
                    violations.append({
                        "level": "warning", "seg_idx": i, 
                        "message": f"⚠ Seg.{i+1} : {consecutive_written} écrits consécutifs",
                        "explanation": self.explanations.get(mod, "")
                    })
            else:
                if last_type == "visual" and mod != "carte_ign":
                    violations.append({
                        "level": "warning", "seg_idx": i, 
                        "message": f"⚠ Seg.{i+1} : 2 visuels consécutifs",
                        "explanation": "L'alternance visuel/écrit est recommandée pour maintenir l'attention."
                    })
                consecutive_written = 0
            last_type = mtype

            # 2. IGN at the very end
            if mod == "carte_ign" and i == n - 1:
                violations.append({
                    "level": "error", "seg_idx": i, 
                    "message": f"✗ Seg.{i+1} : Pas d'IGN à l'arrivée",
                    "explanation": self.explanations.get("carte_ign", "")
                })

            # 3. Gilwell sequence (at least 3)
            if mod == "gilwell":
                seq_len = 1
                # Backwards
                for k in range(idx - 1, -1, -1):
                    if ordered[k][1] == "gilwell": seq_len += 1
                    else: break
                # Forwards
                for k in range(idx + 1, len(ordered)):
                    if ordered[k][1] == "gilwell": seq_len += 1
                    else: break
                
                if seq_len < 3:
                    violations.append({
                        "level": "warning", "seg_idx": i, 
                        "message": f"⚠ Seg.{i+1} : Gilwell trop court ({seq_len}/3)",
                        "explanation": self.explanations.get("gilwell", "")
                    })

            # 3b. Vigenere Max 1 rule
            if mod == "vigenere" and occ_count.get("vigenere", 0) > 1:
                violations.append({
                    "level": "error", "seg_idx": i,
                    "message": f"✗ Seg.{i+1} : Trop de Vigenère (Max 1)",
                    "explanation": self.explanations.get("vigenere", "")
                })

            # 4. Spacing
            if len(history) >= 2 and mod == history[-2]:
                violations.append({
                    "level": "warning", "seg_idx": i, 
                    "message": f"⚠ Seg.{i+1} : espacement insuffisant",
                    "explanation": "Laissez au moins 2 segments entre deux utilisations du même module (sauf pour fusionner des tronçons)."
                })
            history.append(mod)

            # 5. Occurrences
            occ_count[mod] = occ_count.get(mod, 0) + 1
            max_occ = None
            mod_overrides = {}
            if presets_manager:
                mod_overrides = presets_manager.get_overrides(mod)
                max_occ = mod_overrides.get("max_occurrences")
            
            if max_occ is None:
                max_occ = self.categories.get(self.MODULE_CATEGORY.get(mod, ""), {}).get("max_occurrences")
            
            if max_occ is not None and occ_count[mod] > max_occ:
                violations.append({
                    "level": "error", "seg_idx": i, 
                    "message": f"✗ Seg.{i+1} ({mod}) : max {max_occ} dépassé",
                    "explanation": f"Le niveau de difficulté actuel limite ce module à {max_occ} utilisations."
                })

            # 6. Distance
            min_d = 0
            max_d = None
            if presets_manager:
                mod_overrides = presets_manager.get_overrides(mod)
                cat_data = self.categories.get(self.MODULE_CATEGORY.get(mod, ""), {})
                min_d = mod_overrides.get("min_distance_m", cat_data.get("min_distance_m", 0))
                max_d = mod_overrides.get("max_distance_m", cat_data.get("max_distance_m"))
            
            dist = segments[i].get("distance", 0) or 0
            if min_d and dist < min_d:
                violations.append({
                    "level": "warning", "seg_idx": i, 
                    "message": f"⚠ Seg.{i+1} ({mod}) : {dist:.0f}m < min {min_d}m",
                    "explanation": "Ce module n'est pas adapté aux segments trop courts."
                })
            if max_d and dist > max_d:
                violations.append({
                    "level": "warning", "seg_idx": i, 
                    "message": f"⚠ Seg.{i+1} ({mod}) : {dist:.0f}m > max {max_d}m",
                    "explanation": "Ce module n'est pas adapté aux segments trop longs (lisibilité)."
                })

        return violations
