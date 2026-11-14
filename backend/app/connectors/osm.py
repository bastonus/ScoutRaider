"""
OpenStreetMap / Overpass API Connector for ScoutRaider.
Retrieves drinking water points, shelters, viewpoints and historical markers.
"""

import httpx
import logging
from typing import Dict, Any, List
from .base import BaseConnector, ConnectorMetadata

logger = logging.getLogger("scoutraider.connectors.osm")

OVERPASS_URL = "https://overpass-api.de/api/interpreter"


class OSMConnector(BaseConnector):
    @property
    def metadata(self) -> ConnectorMetadata:
        return ConnectorMetadata(
            id="osm_overpass",
            name="OpenStreetMap & Overpass",
            description="Recherche automatique de points d'eau potable, abris bivouac, calvaires et patrimoine naturel le long du tracé.",
            category="geo",
            requires_api_key=False,
            is_enabled=True,
            website="https://www.openstreetmap.org"
        )

    async def test_connection(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get("https://overpass-api.de/api/status")
                return res.status_code == 200
        except Exception:
            return False

    async def fetch(self, query: Dict[str, Any]) -> Dict[str, Any]:
        """
        Fetch POIs within a bounding box or around a central coordinate.
        query keys:
          - lat: float
          - lon: float
          - radius_m: int (default 1500)
          - types: list of tags (e.g. ['drinking_water', 'shelter', 'historic'])
        """
        lat = query.get("lat")
        lon = query.get("lon")
        radius = query.get("radius_m", 1500)
        types = query.get("types", ["drinking_water", "shelter", "historic"])

        if not lat or not lon:
            return {"pois": [], "status": "missing_coords"}

        # Overpass QL query
        filters = []
        if "drinking_water" in types:
            filters.append(f'node["amenity"="drinking_water"](around:{radius},{lat},{lon});')
        if "shelter" in types:
            filters.append(f'node["amenity"="shelter"](around:{radius},{lat},{lon});')
        if "historic" in types:
            filters.append(f'node["historic"](around:{radius},{lat},{lon});')

        ql_code = f"""
        [out:json][timeout:15];
        (
          {" ".join(filters)}
        );
        out body;
        """

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(OVERPASS_URL, data={"data": ql_code})
                resp.raise_for_status()
                data = resp.json()
                
                results = []
                for elem in data.get("elements", []):
                    tags = elem.get("tags", {})
                    name = tags.get("name") or tags.get("description") or tags.get("historic") or "Point d'intérêt"
                    results.append({
                        "id": elem.get("id"),
                        "lat": elem.get("lat"),
                        "lon": elem.get("lon"),
                        "name": name,
                        "type": tags.get("amenity") or tags.get("historic") or "poi",
                        "tags": tags
                    })

                return {"pois": results, "count": len(results), "status": "ok"}
        except Exception as e:
            logger.warning(f"OSM Overpass query failed: {e}")
            return {"pois": [], "error": str(e), "status": "fallback"}
