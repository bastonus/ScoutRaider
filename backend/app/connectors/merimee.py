"""
Base Mérimée / POP (Plateforme Ouverte du Patrimoine) Connector.
Queries official French historic monuments, medieval chapels, castles,
and heritage notices to feed AI riddles and storytelling.
API: data.culture.gouv.fr (Open Data API)
"""

import httpx
import structlog
from typing import Dict, Any, List
from .base import BaseConnector, ConnectorMetadata
from .cache import connector_cache

logger = structlog.get_logger()

# Open Data Culture API - Monuments Historiques (Mérimée)
MERIMEE_API_URL = "https://data.culture.gouv.fr/api/records/1.0/search/"
DATASET_ID = "liste-des-immeubles-proteges-au-titre-des-monuments-historiques"


class MerimeeConnector(BaseConnector):
    @property
    def metadata(self) -> ConnectorMetadata:
        return ConnectorMetadata(
            id="merimee_heritage",
            name="Base Mérimée (Monuments Historiques)",
            description="Recherche les monuments protégés, châteaux, abbayes et légendes historiques à proximité pour les énigmes scoutes.",
            category="heritage",
            requires_api_key=False,
            is_enabled=True,
            website="https://pop.culture.gouv.fr"
        )

    async def test_connection(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(f"{MERIMEE_API_URL}?dataset={DATASET_ID}&rows=1")
                return res.status_code == 200
        except Exception:
            return False

    async def fetch(self, query: Dict[str, Any]) -> Dict[str, Any]:
        """
        Query monuments around coordinates or by commune.
        query parameters:
          - lat: float
          - lon: float
          - radius_m: int (default 3000)
          - commune: str (optional)
          - rows: int (default 10)
        """
        cached = connector_cache.get("merimee_heritage", query)
        if cached:
            return cached

        lat = query.get("lat")
        lon = query.get("lon")
        radius = query.get("radius_m", 3000)
        commune = query.get("commune")
        rows = min(query.get("rows", 10), 50)

        params: Dict[str, Any] = {
            "dataset": DATASET_ID,
            "rows": rows
        }

        if lat is not None and lon is not None:
            # geofilter.distance=lat,lon,radius_in_meters
            params["geofilter.distance"] = f"{lat},{lon},{radius}"
        elif commune:
            params["q"] = f"commune:{commune}"
        else:
            return {"monuments": [], "status": "missing_coords_or_commune"}

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(MERIMEE_API_URL, params=params)
                resp.raise_for_status()
                data = resp.json()

                monuments = []
                for record in data.get("records", []):
                    fields = record.get("fields", {})
                    coords = record.get("geometry", {}).get("coordinates", [])
                    monuments.append({
                        "id": fields.get("reference") or record.get("recordid"),
                        "title": fields.get("tico") or fields.get("titr") or "Monument historique",
                        "commune": fields.get("commune"),
                        "department": fields.get("dpt"),
                        "epoch": fields.get("scle"),  # Siècle
                        "protection": fields.get("stat"),  # Classé / Inscrit
                        "history_snippet": fields.get("historique") or fields.get("hist") or "",
                        "lat": coords[1] if len(coords) > 1 else None,
                        "lon": coords[0] if len(coords) > 0 else None,
                    })

                result = {
                    "monuments": monuments,
                    "count": len(monuments),
                    "status": "ok"
                }
                connector_cache.set("merimee_heritage", query, result)
                return result

        except Exception as e:
            logger.warning("merimee_query_failed", error=str(e))
            # Fallback mock for offline demonstration
            fallback = {
                "monuments": [
                    {
                        "id": "PA0001",
                        "title": "Croix de chemin et chapelle médiévale",
                        "commune": commune or "Commune locale",
                        "epoch": "XIIe siècle",
                        "protection": "Inscrit MH",
                        "history_snippet": "Édifiée par les bâtisseurs romans à la croisée des chemins de pèlerinage.",
                        "lat": lat,
                        "lon": lon
                    }
                ],
                "count": 1,
                "status": "offline_fallback"
            }
            return fallback
