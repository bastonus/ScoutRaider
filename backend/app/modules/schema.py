"""
Module v1 Schema — Strict Pydantic interface contract for ScoutRaider modules.
Defines metadata, rendering types, and probabilistic diffraction constraints.
"""

from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator


class ModuleCategory(str, Enum):
    CRYPTED_MESSAGE = "crypted_message"
    GRAPHIC = "graphic"
    IGN_MAP = "ign_map"
    EXPLICIT_MESSAGE = "explicit_message"
    CUSTOM = "custom"


class RenderType(str, Enum):
    TEXT = "text"
    SVG = "svg"
    GRID = "grid"
    MAP = "map"
    IMAGE = "image"


class DiffractionConstraints(BaseModel):
    """
    Hard and soft constraints governing the distribution of modules over itinerary segments.
    """
    max_proportion: float = Field(
        default=0.40,
        ge=0.0,
        le=1.0,
        description="Plafond de proportionnalité globale sur l'itinéraire (0.0 à 1.0)."
    )
    allow_consecutive: bool = Field(
        default=False,
        description="Interdiction ou autorisation d'enchaîner le même module sur deux tronçons successifs."
    )
    max_consecutive_same_category: int = Field(
        default=3,
        ge=1,
        description="Nombre maximum de tronçons consécutifs utilisant la même catégorie (ex: max 3 messages écrits)."
    )
    min_distance_m: float = Field(
        default=0.0,
        ge=0.0,
        description="Distance minimale d'un tronçon (ou d'une séquence de tronçons) pour être éligible."
    )
    max_distance_m: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Distance maximale autorisée pour ce module."
    )
    max_azimuts: Optional[int] = Field(
        default=None,
        ge=1,
        description="Nombre maximal de changements d'azimuts pouvant être absorbés par une seule étape."
    )
    max_occurrences: Optional[int] = Field(
        default=None,
        ge=0,
        description="Nombre maximum absolu d'occurrences de ce module sur l'ensemble du carnet."
    )
    forbidden_zones: List[str] = Field(
        default_factory=list,
        description="Zones géographiques exclues (ex: 'last_third_of_track', 'high_poi_density')."
    )
    priority_override: Optional[str] = Field(
        default=None,
        description="Condition spéciale d'activation forcée (ex: 'high_poi_density' pour texte_clair)."
    )


class ModuleMetadata(BaseModel):
    """
    V1 Normalized Module Manifest.
    """
    id: str = Field(..., min_length=2, max_length=64, pattern=r"^[a-z0-9_-]+$")
    name: str = Field(..., min_length=2, max_length=128)
    version: str = Field(default="1.0.0", pattern=r"^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$")
    author: str = Field(default="ScoutRaider Team")
    description: str = Field(..., min_length=5)
    category: ModuleCategory = Field(...)
    render_type: RenderType = Field(default=RenderType.TEXT)
    difficulty_weight: float = Field(default=1.0, ge=0.1, le=5.0)
    base_weight: float = Field(default=20.0, ge=0.0)
    constraints: DiffractionConstraints = Field(default_factory=DiffractionConstraints)
    entrypoint: Optional[str] = Field(default="module.py")
    annexes: List[str] = Field(default_factory=list)
    assets: List[str] = Field(default_factory=list)
    rules_explanation: Optional[str] = None
    schema_version: str = Field(default="1.0")

    @field_validator("id")
    @classmethod
    def id_must_be_lowercase(cls, v: str) -> str:
        return v.lower().strip()


class EncodedOutput(BaseModel):
    """
    Standard output payload produced by a module's transformation.
    """
    module_id: str
    solution_text: str
    encoded_text: Optional[str] = None
    svg_content: Optional[str] = None
    grid_data: Optional[List[List[str]]] = None
    render_type: RenderType = RenderType.TEXT
    annexes: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
