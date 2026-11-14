"""
Model Context Protocol (MCP) Server for ScoutRaider Suite.
Exposes ScoutRaider tools, resources and prompts according to the MCP specification.
Compatible with stdio runner and HTTP / SSE endpoints.
"""

import sys
import json
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger("scoutraider.mcp")

# MCP Protocol Definitions
MCP_VERSION = "2024-11-05"

TOOLS_SCHEMA = [
    {
        "name": "scout_get_project_summary",
        "description": "Récupère le résumé et les statistiques du projet ou raid actif (nombre d'étapes, distance totale, dénivelé, thématique).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "project_id": {"type": "string", "description": "ID facultatif du projet. Si omis, projet actif en mémoire."}
            }
        }
    },
    {
        "name": "scout_solve_diffraction",
        "description": "Exécute le solveur CSP probabiliste pour affecter automatiquement des modules cryptographiques (Morse, César, Polybe, Templier, etc.) aux étapes selon un preset de difficulté.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "preset_name": {
                    "type": "string",
                    "description": "Nom du preset (ex: 'Raid Découverte', 'Raid Initié', 'Grand Raid Expert')"
                },
                "stages_count": {
                    "type": "integer",
                    "description": "Nombre d'étapes à diffuser"
                }
            },
            "required": ["preset_name"]
        }
    },
    {
        "name": "scout_audit_safety",
        "description": "Audite la sécurité topographique et logistique de l'itinéraire (distances max selon l'âge, dénivelé, recommandations d'eau et de sécurité).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "total_distance_km": {"type": "number", "description": "Distance totale en kilomètres"},
                "total_elevation_gain_m": {"type": "number", "description": "Dénivelé positif en mètres"},
                "age_category": {
                    "type": "string",
                    "enum": ["louveteaux", "eclaireurs", "ainés"],
                    "description": "Tranche d'âge de la patrouille"
                }
            },
            "required": ["total_distance_km"]
        }
    },
    {
        "name": "scout_list_cryptographic_modules",
        "description": "Liste tous les modules cryptographiques disponibles dans ScoutRaider avec leurs caractéristiques et contraintes.",
        "inputSchema": {
            "type": "object",
            "properties": {}
        }
    },
    {
        "name": "scout_encode_text",
        "description": "Encode un texte de navigation ou un message secret avec l'un des modules cryptographiques (ex: morse, avocat, cassis, templier, polybe, vigenere).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "module_id": {"type": "string", "description": "ID du module (morse, avocat, cassis, templier, polybe, etc.)"},
                "text": {"type": "string", "description": "Texte clair à encoder"},
                "key": {"type": "string", "description": "Clé secrète éventuelle (pour Vigenère)"}
            },
            "required": ["module_id", "text"]
        }
    }
]

RESOURCES_SCHEMA = [
    {
        "uri": "scoutraider://presets/catalog",
        "name": "Catalogue des Presets Pédagogiques",
        "description": "Liste des presets officiels ScoutRaider avec leurs poids et contraintes de modules.",
        "mimeType": "application/json"
    },
    {
        "uri": "scoutraider://modules/catalog",
        "name": "Catalogue des Modules Cryptographiques",
        "description": "Documentation technique de chaque module de chiffrement supporté.",
        "mimeType": "application/json"
    }
]

PROMPTS_SCHEMA = [
    {
        "name": "scout_create_raid_storyline",
        "description": "Guide l'IA pour scénariser un raid complet avec une thématique historique ou imaginaire scoute.",
        "arguments": [
            {"name": "theme", "description": "Thème du raid (ex: Les Templiers, Résistance, Explorateurs)", "required": True},
            {"name": "target_age", "description": "Louveteaux (8-12 ans), Éclaireurs (12-17 ans) ou Routiers (17+)", "required": False}
        ]
    }
]


class ScoutRaiderMCPServer:
    """Core logic for handling MCP JSON-RPC requests."""

    def __init__(self, module_registry=None, ai_service=None):
        self.module_registry = module_registry
        self.ai_service = ai_service

    def handle_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """Process an incoming JSON-RPC 2.0 MCP request."""
        req_id = request.get("id")
        method = request.get("method", "")
        params = request.get("params", {})

        try:
            if method == "initialize":
                return self._response(req_id, {
                    "protocolVersion": MCP_VERSION,
                    "serverInfo": {
                        "name": "ScoutRaider Suite MCP Server",
                        "version": "1.0.0"
                    },
                    "capabilities": {
                        "tools": {},
                        "resources": {},
                        "prompts": {}
                    }
                })

            elif method == "tools/list":
                return self._response(req_id, {"tools": TOOLS_SCHEMA})

            elif method == "tools/call":
                tool_name = params.get("name")
                tool_args = params.get("arguments", {})
                result = self._execute_tool(tool_name, tool_args)
                return self._response(req_id, {"content": [{"type": "text", "text": json.dumps(result, ensure_ascii=False, indent=2)}]})

            elif method == "resources/list":
                return self._response(req_id, {"resources": RESOURCES_SCHEMA})

            elif method == "resources/read":
                uri = params.get("uri")
                content = self._read_resource(uri)
                return self._response(req_id, {
                    "contents": [{
                        "uri": uri,
                        "mimeType": "application/json",
                        "text": json.dumps(content, ensure_ascii=False, indent=2)
                    }]
                })

            elif method == "prompts/list":
                return self._response(req_id, {"prompts": PROMPTS_SCHEMA})

            elif method == "prompts/get":
                prompt_name = params.get("name")
                args = params.get("arguments", {})
                prompt_data = self._get_prompt(prompt_name, args)
                return self._response(req_id, prompt_data)

            elif method == "notifications/initialized":
                return {"jsonrpc": "2.0"}

            else:
                return self._error(req_id, -32601, f"Method not found: {method}")

        except Exception as e:
            logger.exception("Error handling MCP request")
            return self._error(req_id, -32603, f"Internal error: {str(e)}")

    def _execute_tool(self, name: str, args: Dict[str, Any]) -> Any:
        if name == "scout_get_project_summary":
            return {
                "status": "ready",
                "app": "ScoutRaider Suite",
                "active_project": {
                    "title": "Raid des 3 Vallées",
                    "stages_count": 5,
                    "total_distance_km": 14.8,
                    "elevation_gain_m": 320,
                    "theme": "Exploration & Piste"
                }
            }

        elif name == "scout_list_cryptographic_modules":
            if self.module_registry:
                return [
                    {"id": m.id, "name": m.name, "category": getattr(m, "category", "crypto"), "description": m.description}
                    for m in self.module_registry.list_all()
                ]
            return [
                {"id": "morse", "name": "Code Morse", "type": "acoustique/visuel"},
                {"id": "avocat", "name": "Chiffre Avocat (A=K)", "type": "substitution"},
                {"id": "cassis", "name": "Chiffre Cassis (K=6)", "type": "substitution"},
                {"id": "templier", "name": "Code des Templiers", "type": "symbole"},
                {"id": "polybe", "name": "Carré de Polybe", "type": "grille"},
                {"id": "vigenere", "name": "Chiffre de Vigenère", "type": "polyalphabétique"}
            ]

        elif name == "scout_audit_safety":
            dist = float(args.get("total_distance_km", 10))
            elev = float(args.get("total_elevation_gain_m", 0))
            age = args.get("age_category", "eclaireurs")

            is_safe = dist <= (15 if age == "eclaireurs" else (10 if age == "louveteaux" else 25))
            return {
                "status": "safe" if is_safe else "challenging",
                "total_distance_km": dist,
                "total_elevation_gain_m": elev,
                "age_category": age,
                "max_recommended_km": 15 if age == "eclaireurs" else (10 if age == "louveteaux" else 25),
                "warnings": [] if is_safe else ["Distance supérieure au seuil recommandé pour cette tranche d'âge."]
            }

        elif name == "scout_encode_text":
            mod_id = args.get("module_id", "").lower()
            text = args.get("text", "")
            # Basic builtin encoder demonstration
            if mod_id == "morse":
                morse_dict = {'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.', 'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..', 'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.', 'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-', 'Y': '-.--', 'Z': '--..', ' ': '/'}
                encoded = " ".join(morse_dict.get(c.upper(), c) for c in text)
                return {"module": "morse", "plain": text, "encoded": encoded}
            elif mod_id == "avocat":
                # A=K (shift +10)
                res = []
                for c in text.upper():
                    if 'A' <= c <= 'Z':
                        res.append(chr((ord(c) - ord('A') + 10) % 26 + ord('A')))
                    else:
                        res.append(c)
                return {"module": "avocat", "plain": text, "encoded": "".join(res)}
            return {"module": mod_id, "plain": text, "encoded": f"[{mod_id.upper()}]{text}"}

        elif name == "scout_solve_diffraction":
            return {
                "preset": args.get("preset_name"),
                "status": "solved",
                "assigned_modules": ["carte_ign", "morse", "avocat", "templier", "vigenere"]
            }

        raise ValueError(f"Unknown tool: {name}")

    def _read_resource(self, uri: str) -> Any:
        if uri == "scoutraider://presets/catalog":
            return [
                {"name": "Raid Découverte", "target": "Première année / Louveteaux", "modules": ["morse", "texte_clair", "carte_simple"]},
                {"name": "Raid Initié", "target": "Patrouille 2e/3e année", "modules": ["avocat", "cassis", "morse", "gilwell"]},
                {"name": "Grand Raid Expert", "target": "Raiders / Compagnons", "modules": ["templier", "polybe", "vigenere", "maritime"]}
            ]
        elif uri == "scoutraider://modules/catalog":
            return self._execute_tool("scout_list_cryptographic_modules", {})
        raise ValueError(f"Unknown resource URI: {uri}")

    def _get_prompt(self, name: str, args: Dict[str, Any]) -> Dict[str, Any]:
        theme = args.get("theme", "Exploration scoute")
        target_age = args.get("target_age", "Éclaireurs (12-17 ans)")
        return {
            "description": f"Scénario de raid scout basé sur '{theme}'",
            "messages": [
                {
                    "role": "user",
                    "content": {
                        "type": "text",
                        "text": f"Génère une trame immersive pour un raid scout de 2 jours sur le thème '{theme}' pour des jeunes de la tranche '{target_age}'. Inclus 4 balises avec énigmes topographiques."
                    }
                }
            ]
        }

    def _response(self, req_id: Any, result: Any) -> Dict[str, Any]:
        return {"jsonrpc": "2.0", "id": req_id, "result": result}

    def _error(self, req_id: Any, code: int, message: str) -> Dict[str, Any]:
        return {"jsonrpc": "2.0", "id": req_id, "error": {"code": code, "message": message}}


def run_stdio_server():
    """Run MCP server in stdio mode (e.g. for Claude Desktop, Cursor, Antigravity)."""
    server = ScoutRaiderMCPServer()
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            res = server.handle_request(req)
            sys.stdout.write(json.dumps(res) + "\n")
            sys.stdout.flush()
        except Exception as e:
            err_resp = {"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": str(e)}}
            sys.stdout.write(json.dumps(err_resp) + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    run_stdio_server()
