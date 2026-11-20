# mcp

## Overview
Model Context Protocol (MCP) server endpoints exposing ScoutRaider backend tools and Hub v2 resources to AI assistants.

## Interface
- `[server.py] class ScoutRaiderMCPServer`
- `[server.py]   ScoutRaiderMCPServer.__init__()`
- `[server.py]   ScoutRaiderMCPServer.handle_request()`
- `[server.py] def run_stdio_server()`

### Hub Tools Exposés (Agent-First):
- `scout_hub_query_catalog`: Recherche et filtrage du catalogue Hub par ressource/capacité
- `scout_hub_get_manifest`: Extraction du manifeste v2 d'un module
- `scout_hub_validate_manifest`: Validation formelle du JSON Schema v2
- `scout_hub_resolve_dependencies`: Résolution du graphe de dépendances d'une Trame
- `scout_hub_generate_template`: Création autonome d'un squelette de module conforme

## Invariants
- [server.py] Enforces: ValueError(f"Unknown tool: {name}")
- [server.py] Enforces: ValueError(f"Unknown resource URI: {uri}")

## Side Effects
- Network / HTTP / S3 external requests

## Verification
- Run: `pytest tests/ -v`
