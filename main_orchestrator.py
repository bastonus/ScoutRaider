import os
import sys
import json
import subprocess
import importlib
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
import utils.pdf_helpers as ph
from utils.presets_manager import PresetsManager
import refactor_polygonalisation as polypoly

# Path resolution
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))

CONFIG_CODES_PATH = os.path.join(PROJECT_ROOT, 'config', 'config_codes.json')
CATEGORIES_PATH = os.path.join(PROJECT_ROOT, 'config', 'categories.json')
MODULES_DIR = os.path.join(PROJECT_ROOT, 'modules')

class Orchestrator:
    """
    Main engine for assigning modules to geographical segments and generating the PDF.
    
    The Orchestrator ties together:
    - User parameters and configurations (Presets, Theme)
    - Geographical context (Polygonal steps, POIs)
    - Constraints specific to each module (min distance, visual vs written)
    """
    def __init__(self, state_manager=None):
        self.state_manager = state_manager
        self.config = {}
        self.categories = {}
        self.modules = {}
        self.module_manifests = {}
        self.geojson_data = None
        self.segments = []
        if self.state_manager:
            import sys
            import os
            # Use presets manager passed in GUI mode if available, or load a new one
            # The user requested no passing presets_manager to Orchestrator init directly in addingui, 
            # let's just initialize it or get it via some other way. Actually we can just instantiate it.
            self.presets = PresetsManager()
            
            # Load theme
            theme_id = self.state_manager.get_state("theme_id", "Neutre")
            ph.CURRENT_THEME = theme_id
            
            # themes.json is now centralized in 'config'
            theme_file = os.path.join(PROJECT_ROOT, 'config', 'themes.json')
                
            if os.path.exists(theme_file):
                with open(theme_file, 'r', encoding='utf-8') as f:
                    ph.THEME_DATA = json.load(f)
            
            # Load active IGN layer
            ign_layer = self.state_manager.get_state("active_ign_layer", "GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2")
            ph.IGN_LAYER = ign_layer
        else:
            self.presets = PresetsManager()

        self._session_history = [] # For occurrence counts

        self.load_config()
        self._cancelled = False
        self.load_categories()
        self.load_and_check_modules()

    def _load_json_ignore_help(self, filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        if '_help' in data:
            del data['_help']
        return data

    def load_config(self):
        print("Chargement de la configuration...")
        self.config = self._load_json_ignore_help(CONFIG_CODES_PATH)

    def load_categories(self):
        print("Chargement des archétypes de catégories...")
        self.categories = self._load_json_ignore_help(os.path.join(PROJECT_ROOT, 'config', 'constraints_categories.json'))

    def load_and_check_modules(self):
        print("Chargement des modules et des manifests...")
        enabled_modules = self.config.get("enabled", [])
        self.module_manifests = {}
        
        for module_name in enabled_modules:
            module_path = os.path.join(MODULES_DIR, module_name)
            if not os.path.isdir(module_path): continue
                
            # Manifest loading
            manifest_path = os.path.join(module_path, 'manifest.json')
            if os.path.isfile(manifest_path):
                with open(manifest_path, 'r', encoding='utf-8') as f:
                    self.module_manifests[module_name] = json.load(f)
            
            req_file = os.path.join(module_path, 'requirements.txt')
            if os.path.isfile(req_file): self._install_requirements(req_file, module_name)
            
            try:
                mod = importlib.import_module(f"modules.{module_name}.module")
                self.modules[module_name] = mod
                print(f"Module chargé: {module_name} ({self.module_manifests.get(module_name, {}).get('category', 'custom')})")
            except Exception as e:
                print(f"Impossible de charger le module {module_name}: {e}")

    def _install_requirements(self, req_file, module_name):
        with open(req_file, 'r', encoding='utf-8') as f:
            reqs = f.read().strip()
        if reqs:
            print(f"Installation des dépendances pour le module '{module_name}'...")
            try:
                subprocess.check_call([sys.executable, '-m', 'pip', 'install', '-r', req_file])
            except subprocess.CalledProcessError as e:
                print(f"Erreur d'installation des dépendances pour {module_name}. Erreur: {e}")
                sys.exit(1)

    def cancel(self):
        self._cancelled = True

    def load_trajectory(self, geojson_path):
        """
        Loads a GeoJSON, extracts geometries, and executes the polygonalisation.
        
        Args:
            geojson_path (str): File path to the GeoJSON.
        """
        print(f"Chargement et Polygonalisation de la trajectoire depuis {geojson_path}...")
        with open(geojson_path, 'r', encoding='utf-8') as f:
            self.geojson_data = json.load(f)
        
        # Récupération des réglages de polygonalisation du preset actif
        settings = self.presets.get_polygonalisation_settings()
        
        # On délègue la transformation au moteur de polygonalisation
        processed_features = polypoly.process_trajectory_data(
            self.geojson_data,
            tolerance_angle=settings.get("tolerance_angle", 20),
            hors_piste=settings.get("hors_piste", False),
            forcer_carrefours=settings.get("forcer_carrefours", True)
        )
        
        self.segments = []
        for feat in processed_features:
            p = feat.get('properties', {})
            geom = feat.get('geometry', {})
            coords = geom.get('coordinates', [])
            self.segments.append({
                'azimut': p.get('azimut', 0),
                'distance': p.get('metrage', 0),
                'coords': coords,
                'properties': p
            })
        print(f"{len(self.segments)} segments générés (Phase 1).")

    def _get_category_data(self, module_name):
        manifest = self.module_manifests.get(module_name, {})
        cat_name = manifest.get('category') if manifest else None
        if not cat_name: return {}
        return self.categories.get("categories", {}).get(cat_name, {})

    def _evaluate_module(self, module_name, start_idx):
        segments_left = len(self.segments) - start_idx
        if segments_left == 0: return False, 0
            
        # 1. Base category rules (from categories.json)
        cat_data = self._get_category_data(module_name)
        
        # 2. APPLY PRESET OVERRIDES (Priority)
        # This overwrites distance_m, max_occurrences, etc. for this session
        cat_data = self.presets.apply_overrides_to_category(module_name, cat_data)
        
        # 3. Distance Min/Max rules
        min_dist = cat_data.get('min_distance_m', 0)
        max_dist = cat_data.get('max_distance_m')
        
        # 4. Max Azimuts rule
        max_azi = cat_data.get('max_azimuts')
        
        # 5. Max Occurrences (Global session limit)
        max_occ = cat_data.get('max_occurrences')
        if max_occ is not None:
            current_occ = self._session_history.count(module_name)
            if current_occ >= max_occ:
                return False, 0

        # 6. Forbidden Zones
        forbidden = cat_data.get('forbidden_zones', [])
        if "last_third_of_track" in forbidden and start_idx >= len(self.segments) * 2 / 3:
            return False, 0
            
        # Determine valid range of segments (count_min, count_max)
        valid_range = []
        curr_dist = 0
        for count in range(1, segments_left + 1):
            seg = self.segments[start_idx + count - 1]
            curr_dist += seg.get('distance', 0)
            
            if max_azi and count > max_azi: break
            if max_dist and curr_dist > max_dist: break
            
            if curr_dist >= min_dist:
                valid_range.append(count)
        
        if not valid_range:
            return False, 0
            
        # Module-specific validation
        module_impl = self.modules.get(module_name)
        if module_impl and hasattr(module_impl, "evaluate"):
            # Pass valid range [min, max] to module
            ok, mod_count = module_impl.evaluate(start_idx, self.segments, min(valid_range), max(valid_range))
            if ok:
                # Ensure mod_count is within our verified distance range
                if mod_count in valid_range:
                    return True, mod_count
                else:
                    # If module returned something else, pick the closest valid count
                    best_count = min(valid_range, key=lambda x: abs(x - mod_count))
                    return True, best_count
        
        return True, valid_range[0]


    def run(self, input_geojson):
        """Executes the full pipeline: Load -> Orchestrate -> PDF."""
        self.load_trajectory(input_geojson)
        path_plan = self._orchestrate_trajectory()
        self.assemble_carnet(path_plan)
        return path_plan

    def calculate_assignments_from_gui(self):
        """
        Automatically distributes modules over the preset sequence of steps 
        without generating the final PDF. Used for the UI preview.
        
        Returns:
            list: The path_plan outlining module assignments.
        """
        if not self.state_manager:
            raise ValueError("State manager non défini dans l'orchestrateur")
            
        self.geojson_data = self.state_manager.get_state("geojson_data")
        self.segments = self.state_manager.get_state("polygonal_steps", [])
        
        pid = self.state_manager.get_state("active_preset_id")
        if pid: self.presets.set_active_preset(pid)
            
        path_plan = self._orchestrate_trajectory()
        
        assign = self.state_manager.get_state("custom_assignments", {})
        for mod, start_idx, count in path_plan:
            for i in range(count):
                assign[str(start_idx + i)] = mod
        
        self.state_manager.update_state("custom_assignments", assign)
        return path_plan

    def generate_export_from_gui(self, fmt="pdf", output_dir=None, progress_callback=None, opts=None):
        """
        Consumes the UI user assignments, handles logical module fusions, 
        and dispatches generation to the appropriate export format.
        
        Args:
            fmt (str): format of export ('pdf', 'html', 'docx', 'odt')
            output_dir (str): Directory where the files should be created.
            progress_callback (callable, optional): Callback for progress updates.
            opts (dict, optional): Specific options for the format export.
        """
        if not self.state_manager:
            raise ValueError("State manager non défini dans l'orchestrateur")
        
        self.geojson_data = self.state_manager.get_state("geojson_data")
        self.segments = self.state_manager.get_state("polygonal_steps", [])
        assign = self.state_manager.get_state("custom_assignments", {})
        
        path_plan = []
        current_mod = None
        current_start = -1
        current_count = 0
        
        for idx in range(len(self.segments)):
            mod = assign.get(str(idx))
            if not mod or mod == "--- Ignorer ---" or mod not in self.modules:
                mod = "carte_ign" # Fallback
            
            # USER FEATURE: Logical Fusion & SMART SPLITTING
            should_split = False
            if mod == current_mod:
                # Limitation pour Gilwell (Max 7 azimuts par étape)
                if mod == "gilwell" and current_count >= 7:
                    should_split = True
                # Limitation pour Cartes (Max 5 tronçons OU 3000m pour la lisibilité A4)
                elif mod in ("carte_ign", "maritime"):
                    total_dist = sum(s.get('distance', 0) for s in self.segments[current_start:idx+1])
                    if current_count >= 5 or total_dist > 3000:
                        should_split = True
                
                if should_split:
                    path_plan.append((current_mod, current_start, current_count))
                    current_start = idx
                    current_count = 1
                else:
                    current_count += 1
            else:
                if current_mod:
                    path_plan.append((current_mod, current_start, current_count))
                current_mod = mod
                current_start = idx
                current_count = 1
                
        if current_mod:
            path_plan.append((current_mod, current_start, current_count))
            
        if self._cancelled: return None
        
        print(f"--- FUSION LOGIQUE: {len(path_plan)} \u00E9tapes finales apr\u00E8s regroupement ---")
        if progress_callback: progress_callback(f"Fusion logique : {len(path_plan)} étapes après regroupement...", 5)
        
        if fmt == "pdf":
            return self.assemble_carnet(path_plan, output_dir=output_dir, progress_callback=progress_callback)
        elif fmt == "html":
            from utils.export_html import export_html
            return export_html(self, path_plan, output_dir=output_dir, progress_callback=progress_callback, opts=opts)
        elif fmt == "docx":
            from utils.export_docx import export_docx
            return export_docx(self, path_plan, output_dir=output_dir, progress_callback=progress_callback, opts=opts)
        elif fmt == "odt":
            from utils.export_odt import export_odt
            return export_odt(self, path_plan, output_dir=output_dir, progress_callback=progress_callback, opts=opts)
        else:
            raise ValueError(f"Format d'export inconnu: {fmt}")



    def assemble_carnet(self, path_plan, output_dir=None, progress_callback=None):
        print("Assemblage du carnet PDF final...")
        
        raw_coords_list = [s['coords'] for s in self.segments]
        
        if progress_callback: progress_callback("Récupération des POIs (Points d'Intérêt)...", 10)
        ph.set_global_pois(ph.fetch_all_pois(self.segments))
        
        pdf_participant_path = None
        pdf_solution_path = None
        
        out = output_dir if (output_dir and os.path.isdir(output_dir)) else PROJECT_ROOT

        for sol in [False, True]:
            if self._cancelled: break
            role = "Solution" if sol else "Participant"
            if progress_callback: progress_callback(f"Début Génération PDF {role}...", 15 if not sol else 60)
            
            base = ph.get_theme_label('filename', 'Carnet_Contrebandier')
            global_basename = base
            filename = f'{base}_SOLUCE.pdf' if sol else f'{base}.pdf'
            # CRITIQUE : chemin absolu dans le dossier projet, indépendant du CWD
            path = os.path.join(out, filename)
            print(f"-> Génération de {path}")
            
            if sol:
                pdf_solution_path = path
            else:
                pdf_participant_path = path
            
            c = canvas.Canvas(path, pagesize=A4)
            w_pdf, h_pdf = A4
            
            # Cover
            try: c.setFont("Coolvetica", 36)
            except: c.setFont("Helvetica-Bold", 28)
            main_t = ph.get_theme_label('main_title', 'CARNET DE ROUTE')
            if sol: main_t = ph.get_theme_label('soluce_title', 'SOLUCE - CHEFS')
            c.drawCentredString(w_pdf/2, h_pdf/2 + 60, main_t)
            
            start_lat, start_lon = self.segments[0]['coords'][0][1], self.segments[0]['coords'][0][0]
            start_addr = ph.reverse_geocode(start_lat, start_lon)
            c.setFont("Helvetica", 14)
            st_p = ph.get_theme_label('start_point', 'Point de Départ')
            c.drawCentredString(w_pdf/2, h_pdf/2, f"{st_p} : {start_addr}")
            c.setFont("Helvetica-Oblique", 12)
            c.drawCentredString(w_pdf/2, h_pdf/2 - 25, f"Coordonnées GPS : {start_lat:.5f}, {start_lon:.5f}")
            c.showPage()
            
            if sol:
                brut_t = ph.get_theme_label('global_map_brut', "CARTE GLOBALE : TRACÉ BRUT EXACT")
                ph.draw_global_map_page(c, w_pdf, h_pdf, brut_t, raw_coords_list, (0, 0, 0), is_poly=False)
                
                # Transform path_plan to page_plan format for the color map
                legacy_plan = []
                for mod_name, st_idx, count in path_plan:
                    legacy_plan.append({'type': mod_name, 'steps': self.segments[st_idx : st_idx + count]})
                ph.draw_colored_solution_map(c, w_pdf, h_pdf, legacy_plan)
            
            current_y = h_pdf - 60
            current_page = 1
            used_mods = set()
            
            for idx, (mod_name, start_idx, count) in enumerate(path_plan):
                used_mods.add(mod_name)
                module_impl = self.modules.get(mod_name)
                
                if self._cancelled: break
                step_msg = f"[{role}] \u00C9tape {idx+1}/{len(path_plan)} : {mod_name.upper()}"
                p = (15 if not sol else 60) + int((idx / len(path_plan)) * 30)
                if progress_callback: progress_callback(step_msg, p)
                
                if module_impl and hasattr(module_impl, "generate"):
                    try:
                        res = module_impl.generate(c, w_pdf, current_y, self.segments[start_idx:start_idx+count], 
                                                 self.config, self.categories, sol, idx+1)
                        new_y = res.get("new_y", -1)
                        if new_y == -1:
                            # Content doesn't fit on remaining page → start fresh page
                            ph.add_footer_and_page(c, w_pdf, current_page, global_basename)
                            current_page += 1
                            current_y = h_pdf - 60
                            res = module_impl.generate(c, w_pdf, current_y, self.segments[start_idx:start_idx+count], 
                                                     self.config, self.categories, sol, idx+1)
                            new_y = res.get("new_y", -1)
                            if new_y == -1:
                                # Content STILL doesn't fit — force draw with h_limit fallback
                                # This prevents infinite -1 loops and overlap
                                print(f"  ⚠ Module {mod_name} trop grand pour une page, forçage...")
                                current_y = h_pdf - 60
                                new_y = current_y - 20  # Skip this step gracefully
                        
                        # Safety: ensure new_y never goes below page bottom margin
                        if new_y < 60:
                            ph.add_footer_and_page(c, w_pdf, current_page, global_basename)
                            current_page += 1
                            current_y = h_pdf - 60
                        else:
                            current_y = new_y
                    except Exception as e:
                        print(f"Erreur lors de la génération PDF par le module {mod_name}: {e}")
                        if progress_callback: progress_callback(f"⚠ Erreur module {mod_name}: {e}")

            ph.add_footer_and_page(c, w_pdf, current_page, global_basename)
            current_page += 1
            
            # Draw specific annexes
            if used_mods:
                if progress_callback: progress_callback(f"[{role}] Génération des Annexes...", 50 if not sol else 95)
            
            for mod_name in used_mods:
                module_impl = self.modules.get(mod_name)
                if module_impl and hasattr(module_impl, "draw_annexe"):
                    if progress_callback: progress_callback(f"[{role}] Annexe : {mod_name.upper()}", 55 if not sol else 98)
                    try:
                        current_page = module_impl.draw_annexe(c, w_pdf, h_pdf, global_basename, current_page, sol)
                    except Exception as e:
                        print(f"Erreur lors de la génération d'annexe par le module {mod_name}: {e}")
                        
            c.save()
            if progress_callback: progress_callback(f"[{role}] PDF enregistré.", 58 if not sol else 100)
            print(f"PDF {path} terminé avec succès.")
        
        return pdf_participant_path, pdf_solution_path

    def _orchestrate_trajectory(self):
        print("Lancement de l'orchestration dynamique par archétypes...")
        import random
        path_plan = []
        
        history = [] # List of module names
        current_idx = 0
        
        # Exhaustivity tracking (STRICT PER TYPE)
        all_modules = list(self.modules.keys())
        weights_dict = self.presets.get_weights()
        
        # Filtre strict par Preset : On n'utilise que les modules avec un poids > 0
        # (Sauf si le preset ne définit aucun poids, auquel cas on prend tout)
        if weights_dict:
            enabled_modules = [m for m in all_modules if weights_dict.get(m, 0) > 0]
        else:
            enabled_modules = all_modules
            
        # Sécurité : Si aucun module n'est éligible, on prend au moins le texte clair
        if not enabled_modules:
            enabled_modules = ["texte_clair"]
            if "carte_ign" in all_modules: enabled_modules.append("carte_ign")
        
        print(f"Modules autorisés pour ce niveau : {enabled_modules}")

        # Group by type: visual vs written to maintain diversity
        modules_by_type = {"visual": [], "written": []}
        for mod in enabled_modules:
            t = self._get_category_data(mod).get('type', 'written')
            modules_by_type[t].append(mod)
            
        unused_by_type = {
            "visual": set(modules_by_type["visual"]),
            "written": set(modules_by_type["written"])
        }
        
        consecutive_written = 0
        
        # ---------------------------------------------------------
        # ORCHESTRATION LOOP
        # Iterates sequentially over the path segments and determines
        # the most suitable module based on POI density, geometric fit,
        # session history, and thematic rhythms.
        # ---------------------------------------------------------
        
        while current_idx < len(self.segments):
            # 1. Analyze high POI density for Priority Override
            lon, lat = self.segments[current_idx]['coords'][0][:2]
            poi_density = ph.get_poi_count(lon, lat, radius=300)
            
            priority_module = None
            if poi_density > 3: # Threshold
                priority_module = "texte_clair"
            
            # 2. Get candidates
            can_force_visual = (consecutive_written >= 3)
            can_force_written = (history and self._get_category_data(history[-1]).get('type') == 'visual')
            
            candidates = []
            for mod in enabled_modules:
                # --- LOGIQUE DE FILTRAGE ASSOUPLIE ---
                # On ne bloque plus l'immédiat car la fusion logique s'en occupe
                # Mais on garde un petit malus d'espacement pour favoriser la diversité si possible
                
                cat_type = self._get_category_data(mod).get('type', 'written')
                
                # --- LOGIQUE DE LIMITATION ---
                current_occ = history.count(mod)
                max_occ = self.presets.get_overrides(mod).get("max_occurrences")
                if max_occ is None:
                    cat_name = self._get_category_data(mod).get('category', '')
                    max_occ = self.categories.get(cat_name, {}).get("max_occurrences")
                
                if max_occ is not None and current_occ >= max_occ:
                    continue
                # --- LOGIQUE DE FILTRAGE GÉOMÉTRIQUE ---
                fits, count = self._evaluate_module(mod, current_idx)
                
                # Weighting system from Presets
                weights_dict = self.presets.get_weights()
                weight = weights_dict.get(mod, 0)
                
                if not fits or weight <= 0: continue
                
                if mod == priority_module: weight *= 50 # Priority override

                # USER RULE: "Pause IGN after Vigenere"
                if history and history[-1] == "vigenere" and mod == "carte_ign":
                    weight *= 100
                
                candidates.append((mod, count, weight))
            
            if not candidates:
                # Relaxation : On ignore l'espacement mais ON GARDE LE RYTHME si possible
                target_type = 'visual' if can_force_visual else ('written' if can_force_written else None)
                
                print(f"Relaxation des contraintes au segment {current_idx} (Type: {target_type})...")
                
                # Sous-Relaxation 1 : Unused du type cible
                search_types = [target_type] if target_type else ["visual", "written"]
                for t in search_types:
                    for mod in [m for m in unused_by_type[t] if m in enabled_modules]:
                        if history and mod == history[-1]: continue
                        fits, count = self._evaluate_module(mod, current_idx)
                        if fits: candidates.append((mod, count, 10))
                        elif not candidates: # Force fit
                            candidates.append((mod, 1, 1))

            if not candidates:
                # Fallback ultime : On brise tout sauf la répétition immédiate
                # Mais on essaie quand même de vider les unused du type requis
                print(f"Fallback ultime au segment {current_idx}...")
                target_type = 'visual' if can_force_visual else ('written' if can_force_written else None)
                fallback_pool = [m for m in enabled_modules]
                if target_type:
                    pref_pool = [m for m in unused_by_type[target_type] if m in enabled_modules]
                    if pref_pool: fallback_pool = pref_pool
                
                for mod in fallback_pool:
                    if history and mod == history[-1]: continue
                    # Pour le fallback ultime, on accepte le premier segment
                    candidates.append((mod, 1, 1))

            chosen_mod_info = random.choices(candidates, weights=[c[2] for c in candidates], k=1)[0]
            mod_name, consumed = chosen_mod_info[0], chosen_mod_info[1]
            
            path_plan.append((mod_name, current_idx, consumed))
            
            # State Update
            history.append(mod_name)
            self._session_history.append(mod_name)
            
            # Update Unused by type
            cat_type = self._get_category_data(mod_name).get('type', 'written')
            if mod_name in unused_by_type[cat_type]:
                unused_by_type[cat_type].remove(mod_name)
            
            # Reset round for this type if empty
            if not unused_by_type[cat_type]:
                unused_by_type[cat_type] = set(modules_by_type[cat_type])
            
            if cat_type == 'written': consecutive_written += 1
            else: consecutive_written = 0
            
            current_idx += consumed
            
        print("---- PLAN DE PARCOURS GÉNÉRÉ ----")
        for m, start, length in path_plan:
            print(f"- {m.upper()} (Segments: {start} à {start+length-1})")
            
        return path_plan

if __name__ == "__main__":
    orchestrator = Orchestrator()
    orchestrator.run("azimut_simplifie.geojson")
