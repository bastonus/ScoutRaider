"""
Scout Pedagogy, Camp Songs & Trail Lore Connector.
Provides traditional campfire tales, songs, reflection questions,
and pedagogical games indexed by theme and age group.
"""

from typing import Dict, Any, List
from .base import BaseConnector, ConnectorMetadata

# Embedded curated collection of scout traditions
SCOUT_LORE_DATABASE = {
    "chevalerie": {
        "songs": ["Le Chant des Adieux", "La Légende du Feu", "Les Chevaliers du Christ"],
        "challenge": "Reconnaître les qualités de courage et de loyauté au sein de la sizaine/patrouille.",
        "trail_game": "Le tournoi des éclaireurs : relais d'orientation à la boussole et nœuds marins."
    },
    "resistance": {
        "songs": ["Le Chant des Partisans", "La Complainte du Partisan"],
        "challenge": "Furtivité et camouflage : traverser un carrefour sans se faire repérer par le guetteur.",
        "trail_game": "Le message clandestin chiffré en morse ou grille de Polybe."
    },
    "explorateurs": {
        "songs": ["Où vas-tu petit gars ?", "Vent du Sud", "L'Appel de la Forêt"],
        "challenge": "Cartographier à main levée un croquis panoramique du sommet ou col atteint.",
        "trail_game": "Azimut-brute : progresser de 300m uniquement au capier sans dévier."
    },
    "default": {
        "songs": ["C'est l'aventure", "Kyrie des Gueux", "Chant de la Promesse"],
        "challenge": "Respect absolu de la nature (Leave No Trace) : aucun déchet laissé sur le bivouac.",
        "trail_game": "La balise mystère : retrouver le fanion caché à 50 pas au nord du calvaire."
    }
}


class ScoutPedagogyConnector(BaseConnector):
    @property
    def metadata(self) -> ConnectorMetadata:
        return ConnectorMetadata(
            id="scout_pedagogy",
            name="Pédagogie & Traditions Scoutes",
            description="Banque de chants de veillée, défis d'étape, légendes et jeux de piste selon la thématique de raid.",
            category="scout",
            requires_api_key=False,
            is_enabled=True,
            website="https://www.latoilescoute.net"
        )

    async def test_connection(self) -> bool:
        return True  # 100% offline available

    async def fetch(self, query: Dict[str, Any]) -> Dict[str, Any]:
        """
        Query scout lore, songs and challenges.
        query parameters:
          - theme: str (e.g. 'chevalerie', 'resistance', 'explorateurs')
          - age_group: str ('louveteaux', 'eclaireurs', 'ainés')
        """
        raw_theme = (query.get("theme") or "").lower()
        matched_key = "default"

        for key in SCOUT_LORE_DATABASE:
            if key != "default" and key in raw_theme:
                matched_key = key
                break

        data = SCOUT_LORE_DATABASE[matched_key]
        return {
            "theme_matched": matched_key,
            "suggested_songs": data["songs"],
            "patrol_challenge": data["challenge"],
            "suggested_trail_game": data["trail_game"],
            "status": "ok"
        }
