# mcp

## Overview
Model Context Protocol (MCP) server endpoints exposing ScoutRaider backend tools to AI assistants.

## Interface
- `[server.py] class ScoutRaiderMCPServer`
- `[server.py]   ScoutRaiderMCPServer.__init__()`
- `[server.py]   ScoutRaiderMCPServer.handle_request()`
- `[server.py] def run_stdio_server()`

## Invariants
- [server.py] Enforces: ValueError(f"Unknown tool: {name}")
- [server.py] Enforces: ValueError(f"Unknown resource URI: {uri}")

## Side Effects
- Network / HTTP / S3 external requests

## Verification
- Run: `pytest tests/ -v`
