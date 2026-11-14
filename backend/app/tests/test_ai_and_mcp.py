"""
Tests for AI, MCP Server, and Connectors in ScoutRaider.
"""

import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.mcp.server import ScoutRaiderMCPServer

client = TestClient(app)


def test_mcp_initialize():
    server = ScoutRaiderMCPServer()
    req = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {}
    }
    res = server.handle_request(req)
    assert res["id"] == 1
    assert "serverInfo" in res["result"]
    assert res["result"]["serverInfo"]["name"] == "ScoutRaider Suite MCP Server"


def test_mcp_tools_list():
    server = ScoutRaiderMCPServer()
    req = {
        "jsonrpc": "2.0",
        "id": 2,
        "method": "tools/list",
        "params": {}
    }
    res = server.handle_request(req)
    tools = res["result"]["tools"]
    tool_names = [t["name"] for t in tools]
    assert "scout_get_project_summary" in tool_names
    assert "scout_audit_safety" in tool_names
    assert "scout_encode_text" in tool_names


def test_mcp_encode_morse():
    server = ScoutRaiderMCPServer()
    req = {
        "jsonrpc": "2.0",
        "id": 3,
        "method": "tools/call",
        "params": {
            "name": "scout_encode_text",
            "arguments": {"module_id": "morse", "text": "SOS"}
        }
    }
    res = server.handle_request(req)
    assert "content" in res["result"]
    assert "... --- ..." in res["result"]["content"][0]["text"]


def test_api_mcp_endpoint():
    resp = client.post("/api/mcp", json={
        "jsonrpc": "2.0",
        "id": 10,
        "method": "tools/list",
        "params": {}
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "tools" in data["result"]


def test_api_ai_safety_audit():
    payload = {
        "stages": [{"to_label": "Étape 1", "distance_m": 8000}],
        "total_distance_km": 8.0,
        "total_elevation_gain_m": 150.0,
        "age_category": "eclaireurs"
    }
    resp = client.post("/api/ai/safety-audit", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "global_rating" in data
    assert "summary" in data


def test_api_connectors_list():
    resp = client.get("/api/connectors")
    assert resp.status_code == 200
    connectors = resp.json()
    assert any(c["id"] == "osm_overpass" for c in connectors)
