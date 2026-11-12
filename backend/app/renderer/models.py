"""
Renderer Domain Models for ScoutRaider WeasyPrint pipeline.
"""

from typing import List, Dict, Any, Optional
from enum import Enum
from pydantic import BaseModel, Field


class PageOrientation(str, Enum):
    PORTRAIT = "portrait"
    LANDSCAPE = "landscape"


class PageFormat(str, Enum):
    A4 = "a4"
    A5 = "a5"


class CarnetRenderOptions(BaseModel):
    title: str = Field(default="Carnet de Raid")
    subtitle: Optional[str] = Field(default="Édition de Patrouille")
    date_str: Optional[str] = Field(default="2026")
    patrol_name: Optional[str] = Field(default="Patrouille des Chamois")
    is_solution: bool = Field(default=False, description="True for Chiefs/Solution edition, False for Scouts/Participants.")
    orientation: PageOrientation = PageOrientation.PORTRAIT
    page_format: PageFormat = PageFormat.A4
    vigenere_key: str = Field(default="MOUSTACHE")
    include_annexes: bool = True
    include_general_map: bool = True
    theme_accent: str = "#1b4965"
    theme_accent_light: str = "#eef4f8"


class StepRenderBlock(BaseModel):
    step_number: int
    module_id: str
    module_name: str
    distance_m: int
    azimut: int
    solution_text: str
    encoded_text: Optional[str] = None
    svg_content: Optional[str] = None
    grid_data: Optional[List[List[str]]] = None
    render_type: str = "text"
    poi_name: Optional[str] = None
    annexes: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
