"""
Registry of Connectors for ScoutRaider.
Discovers, instantiates and manages connectors lifecycle.
Provides aggregate queries for raid POIs and hazards.
"""

from typing import Dict, List, Optional, Any
from .base import BaseConnector, ConnectorMetadata
from .osm import OSMConnector
from .merimee import MerimeeConnector
from .weather import WeatherConnector
from .pedagogy import ScoutPedagogyConnector


class ConnectorRegistry:
    def __init__(self):
        self._connectors: Dict[str, BaseConnector] = {}
        # Register builtin connectors
        self.register(OSMConnector())
        self.register(MerimeeConnector())
        self.register(WeatherConnector())
        self.register(ScoutPedagogyConnector())

    def register(self, connector: BaseConnector):
        self._connectors[connector.metadata.id] = connector

    def get(self, connector_id: str) -> Optional[BaseConnector]:
        return self._connectors.get(connector_id)

    def list_all(self) -> List[ConnectorMetadata]:
        return [c.metadata for c in self._connectors.values()]

    async def search_pois(self, lat: float, lon: float, radius_m: int = 2000, categories: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """
        Aggregates POIs from OSM (water, shelters, viewpoints) and Base Mérimée (historic monuments).
        """
        results: List[Dict[str, Any]] = []

        # 1. OSM POIs
        osm = self.get("osm_overpass")
        if osm:
            osm_res = await osm.fetch({"lat": lat, "lon": lon, "radius_m": radius_m})
            for p in osm_res.get("pois", []):
                results.append({
                    "source": "osm",
                    "id": f"osm_{p.get('id')}",
                    "name": p.get("name"),
                    "type": p.get("type"),
                    "lat": p.get("lat"),
                    "lon": p.get("lon"),
                    "details": p.get("tags", {})
                })

        # 2. Mérimée Monuments
        merimee = self.get("merimee_heritage")
        if merimee:
            merimee_res = await merimee.fetch({"lat": lat, "lon": lon, "radius_m": radius_m})
            for m in merimee_res.get("monuments", []):
                results.append({
                    "source": "merimee",
                    "id": f"merimee_{m.get('id')}",
                    "name": m.get("title"),
                    "type": "historic_monument",
                    "lat": m.get("lat"),
                    "lon": m.get("lon"),
                    "details": {
                        "epoch": m.get("epoch"),
                        "protection": m.get("protection"),
                        "commune": m.get("commune"),
                        "history": m.get("history_snippet")
                    }
                })

        return results


connector_registry = ConnectorRegistry()
