"""
Integration Tests for AI Copilot, MCP Server, and Connector Hub.
Verifies Phase 1, Phase 2, Phase 3 and Phase 4 of the Strategic Integration Plan.
"""

import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.connectors.registry import connector_registry
from app.connectors.cache import connector_cache


@pytest.mark.asyncio
async def test_ai_status():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/ai/status")
        assert res.status_code == 200
        data = res.json()
        assert "offline_mode_ready" in data
        assert data["offline_mode_ready"] is True
        assert "ollama" in data


@pytest.mark.asyncio
async def test_ai_narrative_offline_fallback():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "theme": "Chevalerie et Légendes",
            "stages": [
                {"to_label": "Croix Saint-Martin", "distance_m": 1200, "azimut": 140},
                {"to_label": "Château Fort", "distance_m": 2400, "azimut": 95}
            ],
            "target_tone": "epic",
            "scout_branch": "eclaireurs"
        }
        res = await client.post("/api/ai/narrative", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert "theme_title" in data
        assert "intro_story" in data
        assert len(data["stage_stories"]) == 2
        assert "outro_story" in data


@pytest.mark.asyncio
async def test_ai_riddle_offline_fallback():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "poi_name": "Dolmen de la Forêt",
            "poi_type": "Mégalithe",
            "historical_hint": "Érigé au néolithique",
            "target_module": "morse",
            "difficulty": "medium"
        }
        res = await client.post("/api/ai/riddle", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert "riddle_text" in data
        assert "solution_word" in data


@pytest.mark.asyncio
async def test_ai_safety_audit():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "stages": [{"to_label": "Bivouac", "distance_m": 12000}],
            "total_distance_km": 12.0,
            "total_elevation_gain_m": 350.0,
            "age_category": "eclaireurs"
        }
        res = await client.post("/api/ai/safety-audit", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["global_rating"] in ["safe", "challenging", "dangerous"]
        assert "alerts" in data
        assert "water_points_advice" in data


@pytest.mark.asyncio
async def test_mcp_json_rpc_initialize_and_tools():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Initialize
        res_init = await client.post("/api/mcp", json={
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {}
        })
        assert res_init.status_code == 200
        init_data = res_init.json()
        assert init_data["result"]["protocolVersion"] == "2024-11-05"

        # 2. Tools list
        res_tools = await client.post("/api/mcp", json={
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/list",
            "params": {}
        })
        assert res_tools.status_code == 200
        tools_data = res_tools.json()
        tools_list = tools_data["result"]["tools"]
        tool_names = [t["name"] for t in tools_list]
        assert "scout_get_project_summary" in tool_names
        assert "scout_audit_safety" in tool_names
        assert "scout_search_pois" in tool_names
        assert "scout_hub_query_catalog" in tool_names

        # 3. Call tool scout_audit_safety
        res_call = await client.post("/api/mcp", json={
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {
                "name": "scout_audit_safety",
                "arguments": {
                    "total_distance_km": 8.5,
                    "age_category": "louveteaux"
                }
            }
        })
        assert res_call.status_code == 200
        call_data = res_call.json()
        content_text = call_data["result"]["content"][0]["text"]
        assert "total_distance_km" in content_text

        # 4. Call tool scout_search_pois
        res_pois = await client.post("/api/mcp", json={
            "jsonrpc": "2.0",
            "id": 4,
            "method": "tools/call",
            "params": {
                "name": "scout_search_pois",
                "arguments": {
                    "latitude": 48.85,
                    "longitude": 2.35,
                    "radius_meters": 1500
                }
            }
        })
        assert res_pois.status_code == 200
        pois_data = res_pois.json()
        assert "pois" in pois_data["result"]["content"][0]["text"]


@pytest.mark.asyncio
async def test_connectors_api():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. List connectors
        res = await client.get("/api/connectors")
        assert res.status_code == 200
        conns = res.json()
        conn_ids = [c["id"] for c in conns]
        assert "osm_overpass" in conn_ids
        assert "merimee_heritage" in conn_ids
        assert "weather_risk" in conn_ids
        assert "scout_pedagogy" in conn_ids

        # 2. Test pedagogy connector
        res_test = await client.get("/api/connectors/scout_pedagogy/test")
        assert res_test.status_code == 200
        assert res_test.json()["reachable"] is True

        # 3. Query pedagogy connector
        res_pedagogy = await client.post("/api/connectors/scout_pedagogy/query", json={"theme": "chevalerie"})
        assert res_pedagogy.status_code == 200
        ped_data = res_pedagogy.json()
        assert "suggested_songs" in ped_data

        # 4. Search POIs endpoint
        res_pois = await client.post("/api/connectors/search-pois", json={
            "latitude": 48.85,
            "longitude": 2.35,
            "radius_meters": 2000
        })
        assert res_pois.status_code == 200
        assert "pois" in res_pois.json()
