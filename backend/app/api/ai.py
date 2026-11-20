"""
AI Copilot REST API Endpoints for ScoutRaider.
Provides routes for:
- Storyline & narrative generation
- Thematic encrypted riddles
- Safety & physical strain auditing
- AI backend status (Ollama offline detection, Cloud keys)
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import Dict, Any
import structlog

from app.ai.service import ai_service
from app.ai.models import (
    GenerateNarrativeRequest,
    GenerateNarrativeResponse,
    GenerateRiddleRequest,
    GenerateRiddleResponse,
    SafetyAuditRequest,
    SafetyAuditResponse
)

logger = structlog.get_logger()

router = APIRouter(prefix="/ai", tags=["AI Copilot"])


@router.post("/narrative", response_model=GenerateNarrativeResponse)
async def generate_narrative_endpoint(payload: GenerateNarrativeRequest):
    """Generates an immersive thematic storyline along the raid itinerary."""
    try:
        return await ai_service.generate_narrative(payload)
    except Exception as e:
        logger.error("ai_narrative_failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Échec de génération narrative : {str(e)}")


@router.post("/riddle", response_model=GenerateRiddleResponse)
async def generate_riddle_endpoint(payload: GenerateRiddleRequest):
    """Generates a pedagogical riddle bound to a landmark/POI and encryption module."""
    try:
        return await ai_service.generate_riddle(payload)
    except Exception as e:
        logger.error("ai_riddle_failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Échec de génération d'énigme : {str(e)}")


@router.post("/safety-audit", response_model=SafetyAuditResponse)
async def safety_audit_endpoint(payload: SafetyAuditRequest):
    """Performs safety and physical strain audit on the raid itinerary."""
    try:
        return await ai_service.audit_safety(payload)
    except Exception as e:
        logger.error("ai_safety_audit_failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Échec de l'audit de sécurité : {str(e)}")


@router.get("/status")
async def ai_status_endpoint():
    """Detects available AI providers, including local Ollama instance on localhost:11434."""
    return await ai_service.check_provider_status()
