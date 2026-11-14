"""
Built-in Diffraction Presets for ScoutRaider.
Migrated from legacy presets.json with modernized quotas and weights.
"""

from typing import Dict
from .models import PresetConfig

BUILTIN_PRESETS: Dict[str, PresetConfig] = {
    "arret_de_promesse_1": PresetConfig(
        id="arret_de_promesse_1",
        name="Débutant (Niveau 1)",
        description="Parcours accessible, forte proportion de texte en clair et initiation légère au Morse.",
        weights={
            "texte_clair": 80.0,
            "morse": 20.0,
            "carte_simple": 0.0,
            "carte_ign": 0.0,
            "vigenere": 0.0,
            "gilwell": 0.0,
            "drapeaux": 0.0,
            "polybe": 0.0,
            "templier": 0.0,
            "maritime": 0.0,
            "avocat": 0.0,
            "cassis": 0.0
        },
        overrides={
            "morse": {"max_occurrences": 3, "max_proportion": 0.25}
        }
    ),
    "seconde_classe_1": PresetConfig(
        id="seconde_classe_1",
        name="Intermédiaire (Niveau 2)",
        description="Introduction de la lecture de carte et des techniques visuelles.",
        weights={
            "texte_clair": 35.0,
            "carte_simple": 20.0,
            "morse": 15.0,
            "carte_ign": 10.0,
            "gilwell": 10.0,
            "drapeaux": 10.0,
            "polybe": 0.0,
            "templier": 0.0,
            "maritime": 0.0,
            "avocat": 0.0,
            "cassis": 0.0,
            "vigenere": 0.0
        },
        overrides={
            "morse": {"max_proportion": 0.30},
            "carte_simple": {"max_proportion": 0.35},
            "carte_ign": {"max_proportion": 0.30}
        }
    ),
    "premiere_classe_1": PresetConfig(
        id="premiere_classe_1",
        name="Avancé (Niveau 3)",
        description="Diversité cryptographique riche (Polybe, Templier, Avocat, Cassis, Morse, Carte Simple).",
        weights={
            "texte_clair": 10.0,
            "carte_simple": 10.0,
            "morse": 15.0,
            "polybe": 15.0,
            "templier": 10.0,
            "avocat": 10.0,
            "cassis": 10.0,
            "carte_ign": 10.0,
            "drapeaux": 10.0,
            "gilwell": 10.0,
            "vigenere": 0.0
        },
        overrides={
            "morse": {"max_occurrences": 5, "max_proportion": 0.25},
            "carte_simple": {"max_proportion": 0.30},
            "vigenere": {"max_occurrences": 0}
        }
    ),
    "raider_1": PresetConfig(
        id="raider_1",
        name="Expert (Niveau 4)",
        description="Orientation poussée avec Vigenère plafonné, signaux maritimes, carte simple et carte IGN.",
        weights={
            "carte_simple": 25.0,
            "carte_ign": 20.0,
            "maritime": 20.0,
            "vigenere": 15.0,
            "gilwell": 10.0,
            "texte_clair": 10.0
        },
        overrides={
            "vigenere": {
                "max_distance_m": 250,
                "max_occurrences": 1,
                "max_proportion": 0.15
            },
            "carte_simple": {
                "max_proportion": 0.35
            }
        }
    )
}
