"""
Pydantic Models for ScoutRaider AI Services.
Supports multi-provider configurations (Gemini, Claude, OpenAI, Ollama),
prompts, narratives, riddles and safety trail auditing.
"""

from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field


class AIProviderConfig(BaseModel):
    provider: Literal["gemini", "claude", "openai", "ollama"] = "gemini"
    api_key: Optional[str] = None
    model_name: Optional[str] = None  # e.g. "gemini-1.5-flash", "claude-3-5-sonnet", "gpt-4o-mini", "llama3"
    endpoint_url: Optional[str] = None  # For Ollama (default: http://localhost:11434) or custom OpenAI-compatible proxies
    temperature: float = 0.7


class GenerateNarrativeRequest(BaseModel):
    theme: str = Field(..., description="Theme for the raid, e.g. 'Chevalerie médiévale', 'Résistance 1944', 'Explorateurs'")
    stages: List[Dict[str, Any]] = Field(default_factory=list, description="List of itinerary stages with distances and azimuts")
    target_tone: Literal["epic", "mysterious", "scout_classic", "humorous"] = "epic"
    scout_branch: Literal["louveteaux", "eclaireurs", "ainés", "patrouille_libre"] = "eclaireurs"
    config: Optional[AIProviderConfig] = None


class GenerateNarrativeResponse(BaseModel):
    theme_title: str
    intro_story: str
    stage_stories: List[Dict[str, Any]]
    outro_story: str
    suggested_music_or_atmosphere: Optional[str] = None


class GenerateRiddleRequest(BaseModel):
    poi_name: str
    poi_type: Optional[str] = None
    historical_hint: Optional[str] = None
    target_module: Optional[str] = "morse"  # e.g. 'morse', 'vigenere', 'templier', etc.
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    config: Optional[AIProviderConfig] = None


class GenerateRiddleResponse(BaseModel):
    riddle_text: str
    solution_word: str
    encoded_solution: Optional[str] = None
    pedagogical_tip: Optional[str] = None


class SafetyAuditRequest(BaseModel):
    stages: List[Dict[str, Any]]
    total_distance_km: float
    total_elevation_gain_m: Optional[float] = 0.0
    season_or_weather: Optional[str] = "printemps_sec"
    age_category: Literal["louveteaux", "eclaireurs", "ainés"] = "eclaireurs"
    config: Optional[AIProviderConfig] = None


class SafetyAuditAlert(BaseModel):
    severity: Literal["info", "warning", "critical"]
    stage_index: Optional[int] = None
    title: str
    description: str
    recommendation: str


class SafetyAuditResponse(BaseModel):
    global_rating: Literal["safe", "challenging", "dangerous"]
    summary: str
    alerts: List[SafetyAuditAlert]
    water_points_advice: str
    emergency_contacts_needed: List[str]
