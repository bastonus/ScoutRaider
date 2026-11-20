"""
External Connectors REST API for ScoutRaider.
Provides routes to query OpenStreetMap, Base Mérimée, Weather & Lore.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional
import structlog

from app.connectors.registry import connector_registry

logger = structlog.get_logger()

router = APIRouter(prefix="/connectors", tags=["Connectors Hub"])


class POISearchRequest(BaseModel):
    latitude: float
    longitude: float
    radius_meters: int = Field(default=2000, ge=100, le=20000)
    categories: Optional[List[str]] = None


class WeatherRiskRequest(BaseModel):
    latitude: float
    longitude: float
    days: int = Field(default=3, ge=1, le=7)


@router.get("")
async def list_connectors():
    """Returns metadata of all registered external connectors."""
    return connector_registry.list_all()


@router.get("/{connector_id}/test")
async def test_connector(connector_id: str):
    """Tests connectivity to a specific external connector."""
    conn = connector_registry.get(connector_id)
    if not conn:
        raise HTTPException(status_code=404, detail=f"Connecteur '{connector_id}' introuvable.")
    is_reachable = await conn.test_connection()
    return {"id": connector_id, "reachable": is_reachable}


@router.post("/{connector_id}/query")
async def query_connector(connector_id: str, query: Dict[str, Any]):
    """Directly queries a specific connector."""
    conn = connector_registry.get(connector_id)
    if not conn:
        raise HTTPException(status_code=404, detail=f"Connecteur '{connector_id}' introuvable.")
    try:
        return await conn.fetch(query)
    except Exception as e:
        logger.error("connector_query_error", connector_id=connector_id, error=str(e))
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/search-pois")
async def search_pois_endpoint(req: POISearchRequest):
    """Aggregates water points, shelters and historical monuments around GPS coordinates."""
    try:
        pois = await connector_registry.search_pois(
            lat=req.latitude,
            lon=req.longitude,
            radius_m=req.radius_meters,
            categories=req.categories
        )
        return {
            "latitude": req.latitude,
            "longitude": req.longitude,
            "radius_meters": req.radius_meters,
            "pois": pois,
            "count": len(pois)
        }
    except Exception as e:
        logger.error("pois_search_failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Erreur de recherche POI : {str(e)}")


@router.post("/weather-risk")
async def weather_risk_endpoint(req: WeatherRiskRequest):
    """Retrieves forecast and evaluates outdoor camping risks for a raid bivouac."""
    weather_conn = connector_registry.get("weather_risk")
    if not weather_conn:
        raise HTTPException(status_code=503, detail="Connecteur météo indisponible.")
    return await weather_conn.fetch({
        "lat": req.latitude,
        "lon": req.longitude,
        "days": req.days
    })
