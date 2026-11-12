"""
Backward Compatibility Adapter for ScoutRaider Modules.
Migrates legacy manifest.json files to the normalized ModuleMetadata schema v1.
Reports missing, defaulted, or deprecated fields explicitly.
"""

import re
from typing import Dict, Any, Tuple, List
from .schema import ModuleMetadata, ModuleCategory, RenderType, DiffractionConstraints

# Default fallback categories constraints from legacy/config/constraints_categories.json
DEFAULT_CATEGORY_CONSTRAINTS: Dict[str, Dict[str, Any]] = {
    "crypted_message": {
        "type": "written",
        "min_distance_m": 0.0,
        "max_distance_m": None,
        "max_azimuts": 2,
        "forbidden_zones": ["high_poi_density"],
        "max_proportion": 0.35,
        "difficulty_weight": 2.0,
        "render_type": "text"
    },
    "graphic": {
        "type": "visual",
        "min_distance_m": 800.0,
        "max_distance_m": 1600.0,
        "max_azimuts": 6,
        "forbidden_zones": ["high_poi_density"],
        "max_proportion": 0.30,
        "difficulty_weight": 3.0,
        "render_type": "svg"
    },
    "ign_map": {
        "type": "visual",
        "min_distance_m": 400.0,
        "max_distance_m": 1200.0,
        "max_azimuts": None,
        "forbidden_zones": ["high_poi_density", "last_third_of_track"],
        "max_proportion": 0.35,
        "difficulty_weight": 1.5,
        "render_type": "map"
    },
    "explicit_message": {
        "type": "written",
        "min_distance_m": 0.0,
        "max_distance_m": None,
        "max_azimuts": 1,
        "forbidden_zones": [],
        "max_proportion": 0.80,
        "difficulty_weight": 1.0,
        "priority_override": "high_poi_density",
        "render_type": "text"
    }
}

MODULE_KNOWN_PROPERTIES: Dict[str, Dict[str, Any]] = {
    "morse": {
        "name": "Code Morse",
        "render_type": RenderType.TEXT,
        "difficulty_weight": 2.0,
        "max_proportion": 0.30,
        "annexes": ["alphabet_morse"],
        "base_weight": 20.0
    },
    "vigenere": {
        "name": "Chiffre de Vigenère",
        "render_type": RenderType.GRID,
        "difficulty_weight": 4.5,
        "max_proportion": 0.15,
        "max_occurrences": 1,
        "annexes": ["tableau_vigenere"],
        "base_weight": 10.0
    },
    "polybe": {
        "name": "Carré de Polybe",
        "render_type": RenderType.GRID,
        "difficulty_weight": 2.5,
        "max_proportion": 0.25,
        "annexes": ["grille_polybe"],
        "base_weight": 20.0
    },
    "gilwell": {
        "name": "Relevé Gilwell",
        "render_type": RenderType.SVG,
        "difficulty_weight": 3.5,
        "max_proportion": 0.25,
        "annexes": ["alphabet_gilwell"],
        "base_weight": 20.0
    },
    "avocat": {
        "name": "Code Avocat",
        "render_type": RenderType.TEXT,
        "difficulty_weight": 1.5,
        "max_proportion": 0.20,
        "annexes": ["methode_avocat"],
        "base_weight": 15.0
    },
    "cassis": {
        "name": "Code Cassis",
        "render_type": RenderType.TEXT,
        "difficulty_weight": 1.5,
        "max_proportion": 0.20,
        "annexes": ["methode_cassis"],
        "base_weight": 15.0
    },
    "templier": {
        "name": "Croix des Templiers",
        "render_type": RenderType.TEXT,
        "difficulty_weight": 3.0,
        "max_proportion": 0.25,
        "annexes": ["alphabet_templier"],
        "base_weight": 20.0
    },
    "maritime": {
        "name": "Pavillons Maritimes",
        "render_type": RenderType.IMAGE,
        "difficulty_weight": 3.0,
        "max_proportion": 0.25,
        "annexes": ["index_maritime"],
        "base_weight": 20.0
    },
    "drapeaux": {
        "name": "Sémaphore Drapeaux",
        "render_type": RenderType.MAP,
        "difficulty_weight": 3.0,
        "max_proportion": 0.25,
        "annexes": ["index_drapeaux"],
        "base_weight": 20.0
    },
    "carte_ign": {
        "name": "Carte IGN Découverte",
        "render_type": RenderType.MAP,
        "difficulty_weight": 1.0,
        "max_proportion": 0.40,
        "annexes": [],
        "base_weight": 30.0
    },
    "carte_simple": {
        "name": "Carte Simple",
        "render_type": RenderType.MAP,
        "difficulty_weight": 1.0,
        "max_proportion": 0.45,
        "annexes": [],
        "base_weight": 35.0
    },
    "texte_clair": {
        "name": "Texte Clair",
        "render_type": RenderType.TEXT,
        "difficulty_weight": 0.5,
        "max_proportion": 0.85,
        "annexes": [],
        "base_weight": 40.0
    }
}


class LegacyManifestAdapter:
    """
    Adapter converting legacy unversioned manifests into strict ModuleMetadata v1.
    """

    @classmethod
    def migrate(
        cls,
        module_id: str,
        raw_manifest: Dict[str, Any],
        discovered_assets: List[str] = None
    ) -> Tuple[ModuleMetadata, List[str]]:
        warnings: List[str] = []
        clean_id = module_id.lower().strip()
        known = MODULE_KNOWN_PROPERTIES.get(clean_id, {})

        # Check if already a v1 schema
        if raw_manifest.get("schema_version") == "1.0" and "constraints" in raw_manifest:
            try:
                meta = ModuleMetadata(**raw_manifest)
                return meta, warnings
            except Exception as e:
                warnings.append(f"Failed direct parsing of v1 manifest: {e}. Falling back to migration.")

        # 1. Normalize Category
        cat_str = raw_manifest.get("category", "crypted_message").lower()
        try:
            category = ModuleCategory(cat_str)
        except ValueError:
            warnings.append(f"Unknown category '{cat_str}'. Defaulting to CUSTOM.")
            category = ModuleCategory.CUSTOM

        # 2. Extract Category Archetype Defaults
        cat_defaults = DEFAULT_CATEGORY_CONSTRAINTS.get(category.value, {})

        # 3. Name & Description
        name = raw_manifest.get("name") or known.get("name") or clean_id.replace("_", " ").title()
        description = raw_manifest.get("description", f"ScoutRaider module {name}")
        rules_exp = raw_manifest.get("rules_explanation")

        # 4. Render Type
        render_type_str = raw_manifest.get("render_type")
        if render_type_str:
            try:
                render_type = RenderType(render_type_str.lower())
            except ValueError:
                render_type = known.get("render_type", RenderType.TEXT)
                warnings.append(f"Unknown render_type '{render_type_str}'. Used fallback {render_type}.")
        else:
            render_type = known.get("render_type")
            if not render_type:
                def_type = cat_defaults.get("render_type", "text")
                render_type = RenderType(def_type)
            warnings.append(f"Field 'render_type' missing. Inferred as '{render_type.value}'.")

        # 5. Extract rules & constraints
        max_proportion = raw_manifest.get(
            "max_proportion",
            known.get("max_proportion", cat_defaults.get("max_proportion", 0.35))
        )
        allow_consecutive = raw_manifest.get("allow_consecutive", False)
        min_dist = raw_manifest.get("min_distance_m", cat_defaults.get("min_distance_m", 0.0))
        max_dist = raw_manifest.get("max_distance_m", cat_defaults.get("max_distance_m", None))
        max_azi = raw_manifest.get("max_azimuts", cat_defaults.get("max_azimuts", None))
        forbidden = list(raw_manifest.get("forbidden_zones", cat_defaults.get("forbidden_zones", [])))
        priority = raw_manifest.get("priority_override", cat_defaults.get("priority_override", None))

        # Check rules_explanation for heuristics
        max_occ = raw_manifest.get("max_occurrences", known.get("max_occurrences", None))
        if rules_exp:
            if "1 seule occurrence" in rules_exp or "1 occurrence" in rules_exp:
                max_occ = 1
                warnings.append("Inferred max_occurrences=1 from rules_explanation.")
            if "évitez d'enchaîner plus de 3" in rules_exp:
                max_consec_cat = 3
            else:
                max_consec_cat = 3
        else:
            max_consec_cat = 3

        constraints = DiffractionConstraints(
            max_proportion=float(max_proportion),
            allow_consecutive=bool(allow_consecutive),
            max_consecutive_same_category=int(max_consec_cat),
            min_distance_m=float(min_dist or 0.0),
            max_distance_m=float(max_dist) if max_dist is not None else None,
            max_azimuts=int(max_azi) if max_azi is not None else None,
            max_occurrences=int(max_occ) if max_occ is not None else None,
            forbidden_zones=forbidden,
            priority_override=priority
        )

        # 6. Difficulty & weights
        diff_weight = float(raw_manifest.get("difficulty_weight", known.get("difficulty_weight", 2.0)))
        base_weight = float(raw_manifest.get("base_weight", known.get("base_weight", 20.0)))

        # 7. Assets & Annexes
        assets = list(raw_manifest.get("assets", []))
        if discovered_assets:
            for a in discovered_assets:
                if a not in assets:
                    assets.append(a)

        annexes = list(raw_manifest.get("annexes", known.get("annexes", [])))

        metadata = ModuleMetadata(
            id=clean_id,
            name=name,
            version=raw_manifest.get("version", "1.0.0"),
            author=raw_manifest.get("author", "ScoutRaider Team"),
            description=description,
            category=category,
            render_type=render_type,
            difficulty_weight=diff_weight,
            base_weight=base_weight,
            constraints=constraints,
            entrypoint=raw_manifest.get("entrypoint", "module.py"),
            annexes=annexes,
            assets=assets,
            rules_explanation=rules_exp,
            schema_version="1.0"
        )

        return metadata, warnings
