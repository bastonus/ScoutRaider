"""
Model Context Protocol (MCP) HTTP Endpoint for ScoutRaider.
Enables external agents (Antigravity, Cursor, Claude Desktop) and in-app components
to communicate with ScoutRaider via JSON-RPC 2.0.
"""

from fastapi import APIRouter, Request, HTTPException
from typing import Dict, Any
import structlog

from app.mcp.server import ScoutRaiderMCPServer
from app.modules.registry import module_registry
from app.ai.service import ai_service

logger = structlog.get_logger()

router = APIRouter(prefix="/mcp", tags=["Model Context Protocol (MCP)"])

# Shared server instance wired with backend modules and AI engine
mcp_server_instance = ScoutRaiderMCPServer(
    module_registry=module_registry,
    ai_service=ai_service
)


@router.post("")
async def handle_mcp_request(request: Request) -> Dict[str, Any]:
    """
    JSON-RPC 2.0 Endpoint for Model Context Protocol.
    Supports methods:
    - initialize
    - tools/list
    - tools/call
    - resources/list
    - resources/read
    - prompts/list
    - prompts/get
    """
    try:
        body = await request.json()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON payload: {str(e)}")

    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Expected a JSON-RPC 2.0 object.")

    response = mcp_server_instance.handle_request(body)
    return response


@router.get("/schema")
async def get_mcp_capabilities():
    """Summary of tools, resources, and prompts exposed by the ScoutRaider MCP server."""
    from app.mcp.server import TOOLS_SCHEMA, RESOURCES_SCHEMA, PROMPTS_SCHEMA, MCP_VERSION
    return {
        "mcp_version": MCP_VERSION,
        "tools_count": len(TOOLS_SCHEMA),
        "tools": TOOLS_SCHEMA,
        "resources_count": len(RESOURCES_SCHEMA),
        "resources": RESOURCES_SCHEMA,
        "prompts_count": len(PROMPTS_SCHEMA),
        "prompts": PROMPTS_SCHEMA
    }
