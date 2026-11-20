"""
Module Schema v2 — Strict Pydantic interface contract for ScoutRaider Unified Hub.
Defines metadata, rendering types, data capabilities, probabilistic diffraction constraints,
custom map configurations, dependency graphs for Trames de Raid, and S3 packaging metadata.
"""

from enum import Enum
from typing import List, Optional, Dict, Any, Union
from pydantic import BaseModel, Field, field_validator


# ─── Legacy & v1 Category Enums ──────────────────────────────────────────────

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
    CANVAS = "canvas"


# ─── Hub v2 Resource Types & Capabilities ────────────────────────────────────

class HubResourceType(str, Enum):
    CRYPTO_MODULE = "crypto_module"         # Modules de chiffrement, encodage & topographie
    MAP_PROVIDER = "map_provider"           # Fonds de cartes intégrés ou personnalisés
    ROUTING_ENGINE = "routing_engine"       # Moteurs de calcul d'itinéraire (BRouter, Valhalla, OSRM, Azimut)
    PATH_PROVIDER = "path_provider"         # Chargeurs & connecteurs de traces/chemins (GPX, GeoJSON, KML, Strava)
    RAID_TRAME = "raid_trame"               # Trames de Raid (scénarios pédagogiques, ex-orchestrations)
    THEME_STYLE = "theme_style"             # Thèmes graphiques, styles d'export WeasyPrint
    SYNTAX_EXTENSION = "syntax_extension"   # Extensions de blocs pour l'éditeur


class DataCapability(str, Enum):
    """
    Explicite la nature des données traitées par un module de chiffrement ou de restitution.
    """
    MAP_PATH = "map_path"                   # Itinéraire / séquence d'azimuts & distances (ex: Gilwell)
    ELEVATION_PROFILE = "elevation_profile" # Profil altimétrique (dénivelé, pentes, courbes de relief)
    MAP_OVERVIEW = "map_overview"           # Aperçu cartographique général / synoptique du raid
    PANORAMIC_SKETCH = "panoramic_sketch"   # Croquis panoramique / topographique de paysage
    NUMERIC = "numeric"                     # Encode uniquement des nombres (coordonnées, métrages)
    ALPHABETIC = "alphabetic"               # Encode des lettres A-Z (Morse, Avocat, Cassis)
    ALPHANUMERIC = "alphanumeric"           # Encode lettres et chiffres (Vigenère étendu, Polybe)
    SYMBOLIC_VISUAL = "symbolic_visual"     # Symboles visuels (Pavillons maritimes, sémaphore, templiers)


class TileProtocol(str, Enum):
    XYZ = "xyz"
    WMTS = "wmts"
    TMS = "tms"
    WMS = "wms"


# ─── Custom Maps & Layers ───────────────────────────────────────────────────

class CustomMapConfig(BaseModel):
    """
    Paramètres techniques pour intégrer des flux cartographiques personnalisés.
    """
    tile_type: TileProtocol = Field(default=TileProtocol.XYZ, description="Protocole du serveur de tuiles")
    tile_url: str = Field(..., description="Modèle d'URL de tuiles (ex: https://tiles.org/{z}/{x}/{y}.png)")
    min_zoom: int = Field(default=1, ge=0, le=24)
    max_zoom: int = Field(default=19, ge=1, le=25)
    projection: str = Field(default="EPSG:3857")
    attribution: str = Field(default="© Carte personnalisée")
    requires_auth: bool = Field(default=False)
    auth_param_name: Optional[str] = Field(default=None, description="Nom du paramètre de clé dans l'URL")
    auth_token: Optional[str] = Field(default=None, description="Clé API ou jeton d'accès")
    custom_headers: Dict[str, str] = Field(default_factory=dict)


# ─── Routing Engines & Path Loaders ─────────────────────────────────────────

class RoutingEngineConfig(BaseModel):
    """
    Paramètres techniques pour un moteur de calcul d'itinéraire (ex: BRouter, Valhalla IGN, OSRM).
    """
    supported_profiles: List[str] = Field(
        default_factory=lambda: ["pedestrian", "hiking", "trekking", "direct"],
        description="Profils de déplacement supportés ('pedestrian', 'hiking', 'direct', 'cycling', etc.)"
    )
    default_profile: str = Field(default="hiking")
    offline_capable: bool = Field(default=False, description="Capacité à calculer des tracés sans connexion Internet")
    elevation_support: bool = Field(default=True, description="Fournit les profils d'élévation sur la géométrie calculée")
    requires_api_key: bool = Field(default=False)
    api_endpoint: Optional[str] = Field(default=None, description="Endpoint de l'API de routage")
    custom_options: Dict[str, Any] = Field(default_factory=dict)


class PathProviderConfig(BaseModel):
    """
    Paramètres pour un connecteur / chargeur de fichiers et d'APIs de chemins (GPX, GeoJSON, KML, Strava).
    """
    supported_formats: List[str] = Field(
        default_factory=lambda: ["gpx", "geojson"],
        description="Extensions et formats supportés ('gpx', 'geojson', 'kml', 'tcx', 'fit')"
    )
    import_types: List[str] = Field(
        default_factory=lambda: ["file_upload", "url_fetch"],
        description="Types d'importation acceptés ('file_upload', 'url_fetch', 'cloud_sync')"
    )
    extracts_elevation: bool = Field(default=True, description="Extrait les altitudes et dénivelés (D+/D-)")
    extracts_waypoints: bool = Field(default=True, description="Extrait les POIs et balises associées")
    requires_auth: bool = Field(default=False)
    auth_provider: Optional[str] = Field(default=None, description="Nom du provider d'authentification (ex: 'strava', 'ign')")


# ─── Dependencies Graph ─────────────────────────────────────────────────────

class ResourceDependency(BaseModel):
    """
    Déclaration d'une dépendance requise par une Trame de Raid.
    """
    id: str = Field(..., description="ID du module requis (ex: 'gilwell', 'morse')")
    version_req: str = Field(default="*", description="Contrainte SemVer (ex: '>=2.0.0', '^1.0.0', '*')")
    role: Optional[str] = Field(default=None, description="Rôle pédagogique dans la trame")
    description: Optional[str] = Field(default=None)
    optional: bool = Field(default=False)


class TrameDependencies(BaseModel):
    """
    Graphe de dépendances complet d'une Trame de Raid.
    """
    required_modules: List[ResourceDependency] = Field(default_factory=list)
    recommended_map: Optional[str] = Field(default=None, description="ID du fond de carte recommandé (ex: 'PLAN.IGN')")
    default_theme: Optional[str] = Field(default=None, description="ID du thème graphique par défaut")


# ─── S3 Packaging & Distribution Metadata ───────────────────────────────────

class S3DistributionMeta(BaseModel):
    """
    Métadonnées de distribution distante sur stockage objet S3.
    """
    s3_key: Optional[str] = Field(default=None, description="Clé d'objet S3 (ex: hub/crypto_module/gilwell/gilwell-2.0.0.zip)")
    checksum_sha256: Optional[str] = Field(default=None, description="Somme de contrôle SHA-256 de l'archive .zip")
    download_url: Optional[str] = Field(default=None, description="URL publique ou pré-signée de téléchargement")
    file_size_bytes: Optional[int] = Field(default=None, ge=0)
    min_scoutraider_version: str = Field(default="2.0.0")


# ─── Diffraction Constraints (CSP) ──────────────────────────────────────────

class DiffractionConstraints(BaseModel):
    """
    Contraintes dures et souples gouvernant la distribution des modules sur les tronçons du raid.
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
        description="Nombre maximum de tronçons consécutifs utilisant la même catégorie."
    )
    min_distance_m: float = Field(
        default=0.0,
        ge=0.0,
        description="Distance minimale d'un tronçon pour être éligible."
    )
    max_distance_m: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Distance maximale autorisée pour ce module."
    )
    max_azimuts: Optional[int] = Field(
        default=None,
        ge=1,
        description="Nombre maximal de changements d'azimuts absorbables par une étape."
    )
    max_occurrences: Optional[int] = Field(
        default=None,
        ge=0,
        description="Nombre maximum d'occurrences de ce module sur le carnet entier."
    )
    forbidden_zones: List[str] = Field(
        default_factory=list,
        description="Zones géographiques exclues (ex: 'last_third_of_track', 'high_poi_density')."
    )
    priority_override: Optional[str] = Field(
        default=None,
        description="Condition spéciale d'activation forcée (ex: 'high_poi_density')."
    )


# ─── V1 Normalized Module Manifest (Backward Compatibility) ─────────────────

class ModuleMetadata(BaseModel):
    """
    V1 Normalized Module Manifest — Preserved for 100% backward compatibility.
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

    # Extension v2 optionnelle dans le conteneur v1
    data_capability: Optional[DataCapability] = None

    @field_validator("id")
    @classmethod
    def id_must_be_lowercase(cls, v: str) -> str:
        return v.lower().strip()


# ─── V2 Unified Hub Manifest (Comprehensive Standard) ───────────────────────

class HubResourceMetadata(BaseModel):
    """
    V2 Manifeste Universel du Hub ScoutRaider.
    Valide n'importe quel type de ressource : crypto, cartes, trames, thèmes, extensions.
    """
    id: str = Field(..., min_length=2, max_length=64, pattern=r"^[a-z0-9_-]+$")
    name: str = Field(..., min_length=2, max_length=128)
    version: str = Field(default="2.0.0", pattern=r"^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$")
    schema_version: str = Field(default="2.0")
    resource_type: HubResourceType = Field(default=HubResourceType.CRYPTO_MODULE)
    author: str = Field(default="ScoutRaider Team")
    license: str = Field(default="MIT")
    description: str = Field(..., min_length=5)

    # Capacités de traitement (obligatoire pour crypto_module)
    data_capability: Optional[DataCapability] = None
    supported_inputs: List[str] = Field(default_factory=list)

    # Rendu et points d'entrée
    render_type: RenderType = Field(default=RenderType.TEXT)
    entrypoint: Optional[str] = Field(default=None, description="Chemin vers le script de calcul (logic/index.ts ou main.py)")
    ui_component: Optional[str] = Field(default=None, description="Chemin vers le composant React (ui/Component.tsx)")

    # Pédagogie scoute
    pedagogy: Dict[str, Any] = Field(default_factory=dict)

    # Contraintes de solveur CSP
    constraints: DiffractionConstraints = Field(default_factory=DiffractionConstraints)

    # Graphe de dépendances (essentiel pour raid_trame)
    dependencies: Optional[TrameDependencies] = None

    # Configuration cartographique (pour map_provider)
    map_config: Optional[CustomMapConfig] = None

    # Configuration moteur de routage (pour routing_engine)
    routing_config: Optional[RoutingEngineConfig] = None

    # Configuration chargeur de chemins (pour path_provider)
    path_provider_config: Optional[PathProviderConfig] = None

    # Métadonnées de distribution S3
    s3: Optional[S3DistributionMeta] = None

    # Assets & Annexes
    annexes: List[Dict[str, Any]] = Field(default_factory=list)
    assets: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)

    @field_validator("id")
    @classmethod
    def id_must_be_lowercase(cls, v: str) -> str:
        return v.lower().strip()


# ─── Encoded Output Contract ─────────────────────────────────────────────────

class EncodedOutput(BaseModel):
    """
    Payload standard produit par la transformation d'un module d'encodage ou de topographie.
    """
    module_id: str
    solution_text: str
    encoded_text: Optional[str] = None
    svg_content: Optional[str] = None
    grid_data: Optional[List[List[str]]] = None
    render_type: RenderType = RenderType.TEXT
    annexes: List[str] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
