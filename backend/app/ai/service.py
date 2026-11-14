"""
AI Multi-Provider Service for ScoutRaider.
Handles Gemini, Claude (Anthropic), OpenAI, and Ollama (Local LLM),
with an offline fallback when no provider is configured or reachable.
"""

import os
import json
import logging
import httpx
from typing import Optional, Dict, Any

from .models import (
    AIProviderConfig,
    GenerateNarrativeRequest,
    GenerateNarrativeResponse,
    GenerateRiddleRequest,
    GenerateRiddleResponse,
    SafetyAuditRequest,
    SafetyAuditResponse,
    SafetyAuditAlert
)
from .prompts import (
    SCOUT_MASTER_SYSTEM_PROMPT,
    NARRATIVE_PROMPT_TEMPLATE,
    RIDDLE_PROMPT_TEMPLATE,
    SAFETY_AUDIT_PROMPT_TEMPLATE
)

logger = logging.getLogger("scoutraider.ai")


class AIService:
    def __init__(self, default_config: Optional[AIProviderConfig] = None):
        self.default_config = default_config or AIProviderConfig(
            provider="ollama" if os.getenv("OLLAMA_HOST") else "gemini",
            api_key=os.getenv("GEMINI_API_KEY") or os.getenv("OPENAI_API_KEY") or os.getenv("ANTHROPIC_API_KEY")
        )

    async def _call_llm_json(self, prompt: str, system_prompt: str, config: Optional[AIProviderConfig] = None) -> Dict[str, Any]:
        """Dispatch call to the requested provider and return parsed JSON."""
        cfg = config or self.default_config
        provider = (cfg.provider or "gemini").lower()

        try:
            if provider == "gemini":
                return await self._call_gemini(prompt, system_prompt, cfg)
            elif provider == "claude":
                return await self._call_claude(prompt, system_prompt, cfg)
            elif provider == "openai":
                return await self._call_openai(prompt, system_prompt, cfg)
            elif provider == "ollama":
                return await self._call_ollama(prompt, system_prompt, cfg)
            else:
                logger.warning(f"Unknown provider '{provider}', falling back to Ollama or local template.")
                return await self._call_ollama(prompt, system_prompt, cfg)
        except Exception as e:
            logger.warning(f"AI provider {provider} call failed ({e}). Using offline heuristic fallback.")
            raise

    # ─── Provider Implementations ────────────────────────────────────────────────

    async def _call_gemini(self, prompt: str, system_prompt: str, cfg: AIProviderConfig) -> Dict[str, Any]:
        api_key = cfg.api_key or os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY is not configured.")

        model = cfg.model_name or "gemini-1.5-flash"
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

        payload = {
            "system_instruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": cfg.temperature,
                "response_mime_type": "application/json"
            }
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
            raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
            return json.loads(raw_text)

    async def _call_openai(self, prompt: str, system_prompt: str, cfg: AIProviderConfig) -> Dict[str, Any]:
        api_key = cfg.api_key or os.getenv("OPENAI_API_KEY")
        endpoint = cfg.endpoint_url or "https://api.openai.com/v1/chat/completions"
        model = cfg.model_name or "gpt-4o-mini"

        headers = {"Authorization": f"Bearer {api_key}"}
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            "response_format": {"type": "json_object"},
            "temperature": cfg.temperature
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(endpoint, json=payload, headers=headers)
            resp.raise_for_status()
            raw_text = resp.json()["choices"][0]["message"]["content"]
            return json.loads(raw_text)

    async def _call_claude(self, prompt: str, system_prompt: str, cfg: AIProviderConfig) -> Dict[str, Any]:
        api_key = cfg.api_key or os.getenv("ANTHROPIC_API_KEY")
        model = cfg.model_name or "claude-3-5-sonnet-20241022"

        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }
        payload = {
            "model": model,
            "system": system_prompt,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": cfg.temperature,
            "max_tokens": 2048
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post("https://api.anthropic.com/v1/messages", json=payload, headers=headers)
            resp.raise_for_status()
            raw_text = resp.json()["content"][0]["text"]
            # Clean possible markdown fence
            if "```json" in raw_text:
                raw_text = raw_text.split("```json")[1].split("```")[0].strip()
            elif "```" in raw_text:
                raw_text = raw_text.split("```")[1].split("```")[0].strip()
            return json.loads(raw_text)

    async def _call_ollama(self, prompt: str, system_prompt: str, cfg: AIProviderConfig) -> Dict[str, Any]:
        endpoint = cfg.endpoint_url or os.getenv("OLLAMA_HOST", "http://localhost:11434")
        url = f"{endpoint.rstrip('/')}/api/generate"
        model = cfg.model_name or "llama3"

        payload = {
            "model": model,
            "system": system_prompt,
            "prompt": prompt,
            "format": "json",
            "stream": False,
            "options": {"temperature": cfg.temperature}
        }

        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            raw_text = resp.json().get("response", "{}")
            return json.loads(raw_text)

    # ─── High-Level Scout Capabilities ──────────────────────────────────────────

    async def generate_narrative(self, req: GenerateNarrativeRequest) -> GenerateNarrativeResponse:
        stages_str = json.dumps(req.stages, indent=2, ensure_ascii=False)
        prompt = NARRATIVE_PROMPT_TEMPLATE.format(
            theme=req.theme,
            target_tone=req.target_tone,
            scout_branch=req.scout_branch,
            stages_json=stages_str
        )

        try:
            data = await self._call_llm_json(prompt, SCOUT_MASTER_SYSTEM_PROMPT, req.config)
            return GenerateNarrativeResponse(
                theme_title=data.get("theme_title", f"Raid : {req.theme}"),
                intro_story=data.get("intro_story", "La patrouille prend le départ..."),
                stage_stories=data.get("stage_stories", []),
                outro_story=data.get("outro_story", "Félicitations pour avoir mené à bien ce raid."),
                suggested_music_or_atmosphere=data.get("suggested_music_or_atmosphere")
            )
        except Exception:
            # Deterministic Fallback if offline
            logger.info("Using deterministic narrative offline generator.")
            stage_stories = []
            for idx, st in enumerate(req.stages):
                label = st.get("to_label") or f"Étape {idx+1}"
                dist = st.get("distance_m", 1000)
                stage_stories.append({
                    "stage_index": idx,
                    "title": f"La Marche vers {label}",
                    "story_snippet": f"La troupe avance résolument sur {dist} mètres. Restez attentifs aux traces et aux carrefours.",
                    "moral_or_challenge": "Observez le balisage sans laisser de trace."
                })

            return GenerateNarrativeResponse(
                theme_title=f"Grand Raid : {req.theme}",
                intro_story=f"L'aventure commence sous le signe de '{req.theme}'. Que chaque patrouillard reste vigilant et solidaire.",
                stage_stories=stage_stories,
                outro_story="Mission accomplie. Le camp est dressé, le feu peut s'allumer.",
                suggested_music_or_atmosphere="Chant de la promesse ou Appel du camp"
            )

    async def generate_riddle(self, req: GenerateRiddleRequest) -> GenerateRiddleResponse:
        prompt = RIDDLE_PROMPT_TEMPLATE.format(
            poi_name=req.poi_name,
            poi_type=req.poi_type or "Lieu remarquable",
            historical_hint=req.historical_hint or "Élément du patrimoine local",
            difficulty=req.difficulty,
            target_module=req.target_module or "morse"
        )

        try:
            data = await self._call_llm_json(prompt, SCOUT_MASTER_SYSTEM_PROMPT, req.config)
            return GenerateRiddleResponse(
                riddle_text=data.get("riddle_text", f"Où se dresse fièrement {req.poi_name} ?"),
                solution_word=data.get("solution_word", req.poi_name.upper().replace(" ", "")),
                pedagogical_tip=data.get("pedagogical_tip", "Vérifiez les détails architecturaux.")
            )
        except Exception:
            clean_word = "".join(c for c in req.poi_name.upper() if c.isalnum())
            return GenerateRiddleResponse(
                riddle_text=f"À l'ombre des pierres et des chemins, cherchez le nom secret de ce lieu : {req.poi_name}.",
                solution_word=clean_word or "BALISE",
                pedagogical_tip="Demandez aux éclaireurs de vérifier l'inscription sur la borne ou le porche."
            )

    async def audit_safety(self, req: SafetyAuditRequest) -> SafetyAuditResponse:
        stages_str = json.dumps(req.stages, indent=2, ensure_ascii=False)
        prompt = SAFETY_AUDIT_PROMPT_TEMPLATE.format(
            total_distance_km=req.total_distance_km,
            total_elevation_gain_m=req.total_elevation_gain_m or 0.0,
            season_or_weather=req.season_or_weather or "tempéré",
            age_category=req.age_category,
            stages_json=stages_str
        )

        try:
            data = await self._call_llm_json(prompt, SCOUT_MASTER_SYSTEM_PROMPT, req.config)
            alerts = [SafetyAuditAlert(**a) for a in data.get("alerts", [])]
            return SafetyAuditResponse(
                global_rating=data.get("global_rating", "safe"),
                summary=data.get("summary", "Parcours conforme."),
                alerts=alerts,
                water_points_advice=data.get("water_points_advice", "Prévoir 2L d'eau par scout."),
                emergency_contacts_needed=data.get("emergency_contacts_needed", ["112", "15"])
            )
        except Exception:
            # Deterministic calculation
            alerts = []
            rating = "safe"
            if req.total_distance_km > 20:
                rating = "challenging"
                alerts.append(SafetyAuditAlert(
                    severity="warning",
                    title="Distance totale soutenue",
                    description=f"{req.total_distance_km:.1f} km représente une distance conséquente pour la catégorie {req.age_category}.",
                    recommendation="Prévoir une halte prolongée et vérifier le contenu des sacs."
                ))
            if (req.total_elevation_gain_m or 0) > 600:
                rating = "challenging"
                alerts.append(SafetyAuditAlert(
                    severity="warning",
                    title="Dénivelé significatif",
                    description=f"+{req.total_elevation_gain_m}m de dénivelé cumulé.",
                    recommendation="Adapter l'allure de marche (compter 1h pour 300m de montée)."
                ))

            return SafetyAuditResponse(
                global_rating=rating,
                summary=f"Audit automatique : Itinéraire de {req.total_distance_km:.1f} km, dénivelé +{req.total_elevation_gain_m}m.",
                alerts=alerts,
                water_points_advice="Prévoir au minimum 1.5L à 2L d'eau par personne et repérer les points d'eau potable.",
                emergency_contacts_needed=["SAMU (15)", "Numéro d'urgence européen (112)", "Gendarmerie locale"]
            )
