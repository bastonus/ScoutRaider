"""
Tests for AI, MCP Server, and Connectors in ScoutRaider.
Note: MCP, AI, and Connectors API endpoints are not currently exposed via HTTP.
These tests verify the internal MCP server and connector logic.
"""

import pytest
from app.mcp.server import ScoutRaiderMCPServer
from app.connectors.registry import connector_registry


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


def test_connectors_registry():
    """Test that connector registry works and has OSM connector."""
    connectors = connector_registry.list_all()
    assert len(connectors) >= 1
    connector_ids = [c.id for c in connectors]
    assert "osm_overpass" in connector_ids


def test_osm_connector_search():
    """Test OSM connector POI search."""
    import asyncio
    connector = connector_registry.get("osm_overpass")
    assert connector is not None

    # Test search (this makes a real HTTP request to Overpass API)
    # Using a known location - Paris, France
    result = asyncio.run(connector.fetch({
        "lat": 48.8566,
        "lon": 2.3522,
        "radius_m": 1000,
        "types": ["drinking_water", "shelter", "historic"]
    }))
    assert "pois" in result
    assert isinstance(result["pois"], list)