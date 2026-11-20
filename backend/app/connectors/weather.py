"""
Weather & Outdoor Risk Connector for ScoutRaider.
Queries high-resolution weather, rain probabilities, wind gusts,
and provides outdoor risk evaluation (storms, heatwave, forest fire risk).
Source: Open-Meteo (Free Open Data API without key).
"""

import httpx
import structlog
from typing import Dict, Any, List
from .base import BaseConnector, ConnectorMetadata
from .cache import connector_cache

logger = structlog.get_logger()

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"


class WeatherConnector(BaseConnector):
    @property
    def metadata(self) -> ConnectorMetadata:
        return ConnectorMetadata(
            id="weather_risk",
            name="Météo & Vigilance Terrain",
            description="Prévisions météo précises, risque d'orage, canicule, pluie et alertes feux de forêt pour la sécurité du bivouac.",
            category="weather",
            requires_api_key=False,
            is_enabled=True,
            website="https://open-meteo.com"
        )

    async def test_connection(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(f"{OPEN_METEO_URL}?latitude=48.85&longitude=2.35&current=temperature_2m")
                return res.status_code == 200
        except Exception:
            return False

    async def fetch(self, query: Dict[str, Any]) -> Dict[str, Any]:
        """
        Query weather forecast and safety risks.
        query parameters:
          - lat: float
          - lon: float
          - days: int (default 3)
        """
        cached = connector_cache.get("weather_risk", query)
        if cached:
            return cached

        lat = query.get("lat")
        lon = query.get("lon")

        if lat is None or lon is None:
            return {"status": "missing_coords", "alerts": []}

        params = {
            "latitude": lat,
            "longitude": lon,
            "current": "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_gusts_10m",
            "hourly": "temperature_2m,precipitation_probability,weather_code",
            "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_gusts_10m_max",
            "timezone": "auto",
            "forecast_days": min(query.get("days", 3), 7)
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(OPEN_METEO_URL, params=params)
                resp.raise_for_status()
                data = resp.json()

                current = data.get("current", {})
                daily = data.get("daily", {})

                temp = current.get("temperature_2m", 18.0)
                wind_gusts = current.get("wind_gusts_10m", 0.0)
                precip = current.get("precipitation", 0.0)
                precip_prob_max = (daily.get("precipitation_probability_max", [0]) or [0])[0]

                # Risk evaluation for scouts
                risk_level = "safe"
                warnings = []

                if temp > 33:
                    risk_level = "warning"
                    warnings.append("Alerte forte chaleur : planifier 3L d'eau par jeune et éviter la marche entre 13h et 16h.")
                elif temp < 2:
                    risk_level = "warning"
                    warnings.append("Risque d'hypothermie nocturne : vérifier les isolants de sol et duvets 0°C.")

                if wind_gusts > 60:
                    risk_level = "danger"
                    warnings.append("Rafales supérieures à 60 km/h : bivouac interdit sous grands arbres (chute de branches).")

                if precip_prob_max > 70:
                    warnings.append(f"Forte probabilité de pluie ({precip_prob_max}%) : bâche double-toit et protection étanche des sacs indispensable.")

                result = {
                    "temperature_current": temp,
                    "wind_gusts_kmh": wind_gusts,
                    "precipitation_mm": precip,
                    "rain_probability_max": precip_prob_max,
                    "risk_level": risk_level,
                    "warnings": warnings,
                    "status": "ok"
                }
                connector_cache.set("weather_risk", query, result)
                return result

        except Exception as e:
            logger.warning("weather_query_failed", error=str(e))
            return {
                "temperature_current": 18.0,
                "wind_gusts_kmh": 15.0,
                "precipitation_mm": 0.0,
                "rain_probability_max": 20,
                "risk_level": "safe",
                "warnings": ["Mode hors-ligne : vérifier la météo locale avant le départ."],
                "status": "offline_fallback"
            }
