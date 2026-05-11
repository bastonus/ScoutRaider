/**
 * types.ts — Shared data interfaces for ScoutRaider Suite v5
 * Used by StateManager, CarnetEngine, ConstraintChecker, and all UI components.
 */

// ─────────────────────────────────────────────────────────────────────────────
// GEO / SEGMENTS
// ─────────────────────────────────────────────────────────────────────────────

/** A single stage in the route (A, B, C…) — user-placed waypoints */
export interface Stage {
    id: string;
    coords: [number, number]; // [lat, lon]
    label: string; // "A", "B", "C"…
    address?: string; // Optional precise address set via IGN search
}

/** A polygonalised segment (one azimut leg) */
export interface PolySegment {
    azimut: number;
    distance: number;
    coords: [number, number][];
    properties: {
        azimut: number;
        metrage: number;
        coords_intersection: [number, number];
        start_idx: number;
        point_idx: number;
    };
    /** Which leg this segment belongs to (for UI effects) */
    leg_key?: string;
    /** Module assigned to this segment (for encoding tool) */
    assigned_module?: string;
    /** POI nearest to this segment's turning point (persisted in .srdoc) */
    poi?: { name: string; type: string; distance_m: number } | null;
}

/** A GeoJSON Feature representing a polygonalised segment */
export interface SegmentFeature {
    type: "Feature";
    properties: {
        azimut: number;
        metrage: number;
        coords_intersection: [number, number];
        start_idx: number;
        point_idx: number;
    };
    geometry: {
        type: "LineString";
        coordinates: [number, number][];
    };
}

/** A route leg (A→B computed path) */
export interface LegRoute {
    name: string;      // "A → B"
    leg_key: string;   // unique key for caching
    geometry: {
        type: "LineString";
        coordinates: [number, number][];
        properties?: {
            is_fallback?: boolean;
            danger_level?: DangerLevel | null;
        };
    };
}

export type DangerLevel = 'extreme' | 'high' | 'minor' | 'motorway_cross';

/** A route dict — stored in state.routes[] */
export interface RouteDict {
    id: string; // The leg_key, e.g. leg_A_B
    name?: string;
    distance_m: number;
    geojson: any; // GeoJSON Feature or FeatureCollection
    alternatives?: LegRoute[]; // array of LegRoute showing alternate calculated paths
    color?: string;
    visible?: boolean;
    locked?: boolean;
    order?: number;
    profile?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// POLYGONALISATION SETTINGS
// ─────────────────────────────────────────────────────────────────────────────

export interface PolygonalisationSettings {
    tolerance: number;        // angle tolerance in degrees (default 45)
    allow_offroad: boolean;   // hors-piste mode — straight lines
    force_intersections: boolean; // detect & force splits at road crossings
    min_dist: number;         // minimum segment length in meters
    bypassed: boolean;        // if true, skip polygonalisation
    masked_nodes: number[];
    forced_nodes: number[];
}

// ─────────────────────────────────────────────────────────────────────────────
// PRESETS
// ─────────────────────────────────────────────────────────────────────────────

export interface PresetOverrides {
    min_distance_m?: number;
    max_distance_m?: number;
    max_occurrences?: number;
    max_azimuts?: number;
}

export interface PresetData {
    name: string;
    polygonalisation?: {
        tolerance_angle: number;
        hors_piste: boolean;
        forcer_carrefours: boolean;
    };
    weights: Record<string, number>;
    overrides: Record<string, PresetOverrides>;
}

export interface PresetsFile {
    active_preset: string | null;
    factory: Record<string, PresetData>;
    custom: Record<string, PresetData>;
}

// ─────────────────────────────────────────────────────────────────────────────
// THEMES
// ─────────────────────────────────────────────────────────────────────────────

export interface ThemeData {
    description?: string;
    icon?: string;
    preview_image?: string;
    intros: string[];
    actions: string[];
    poi: string | string[]; // Allow string for backward compatibility, but target is string[]
    poi_contextual?: Record<string, string[]>;
    vigenere_key: string;
    drapeaux_intros: string[];
    drapeaux_real: string[];
    drapeaux_fake: string[];
    drapeaux_outro: string[];
    labels?: Record<string, string>;
}

export type ThemesFile = Record<string, ThemeData>;

/** Partial theme overrides from app state (user customizations) */
export type ThemeOverrides = Partial<ThemeData> & Record<string, any>;

// ─────────────────────────────────────────────────────────────────────────────
// MODULE REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

export interface ModuleManifest {
    category: ModuleCategory;
    description: string;
    rules_explanation?: string;
    type: 'visual' | 'written';
}

export type ModuleCategory = 'crypted_message' | 'graphic' | 'ign_map' | 'explicit_message';

export interface CategoryConstraints {
    type: 'visual' | 'written';
    min_distance_m?: number;
    max_distance_m?: number | null;
    max_azimuts?: number | null;
    max_occurrences?: number;
    forbidden_zones?: string[];
    priority?: string;
    trigger?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// ORCHESTRATOR
// ─────────────────────────────────────────────────────────────────────────────

/** A single entry in the path plan: [moduleName, startIndex, segmentCount] */
export type PathPlanEntry = [string, number, number];

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

export interface ValidationViolation {
    level: 'error' | 'warning';
    seg_idx: number;
    message: string;
    explanation: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// CARNET / TEXT MODE
// ─────────────────────────────────────────────────────────────────────────────

/** A single step (étape) in the carnet. Maps to a route segment. */
export interface CarnetStep {
    id: string;
    /** Route stage labels bracketing this segment, e.g. ["A", "B"] */
    fromLabel: string;
    toLabel: string;
    /** The encoding module assigned to this segment */
    moduleId: ModuleId;
    /** Distance in metres */
    distanceM: number;
    /** Azimuth in degrees (0–360) */
    azimuth: number;
    /** Coordinates of this segment */
    coords: [number, number][];
    /** Plain text solution content (visible in Orga mode) */
    solutionText: string;
    /** Encoded version of the content */
    encodedText: string;
    /** Navigation language style overriding the default random mix */
    navLanguage?: NavLanguage;
    /** List of POIs retrieved around this step from the backend */
    pois?: POIResult[];
    /** Constraint violations for this step */
    warnings: ConstraintWarning[];
    /** If true, this is a manual commentary block, not calculated from route */
    isManual?: boolean;
    /**
     * Type of manual block: 'html' for CKEditor rich content, 'code' for encoded textual module.
     * Only relevant when isManual === true.
     */
    manualType?: 'html' | 'code';
    /**
     * If true, this computed step's text has been manually edited by the user.
     * When set, constraint warnings are suppressed for this step.
     */
    isEdited?: boolean;
    /**
     * For manual steps: the polygonal segment index of the LAST segment
     * of the computed step that precedes this comment.
     * Used by autoRebuildCarnet to re-insert the comment in the right place
     * even when preceding steps merge/split due to module reassignment.
     * -1 = insert at the very beginning (before all computed steps).
     */
    anchorSegmentIdx?: number;
    /** Map zoom level for this step's Leaflet map (if carte_ign/drapeaux) */
    mapZoom?: number;
    /** Map center override for this step */
    mapCenter?: [number, number];
    /**
     * Persisted map state for carte_ign/drapeaux mini-maps.
     * Stores the user-chosen zoom level and bounding box so the map
     * reopens exactly as the user left it.
     */
    mapPersist?: {
        zoom: number;
        center: [number, number];
        bounds?: [[number, number], [number, number]];
    };
    /** Indices of polygonal segments that this step encompasses */
    segmentIndices?: number[];
    /** Gilwell SVG string (computed live) */
    gilwellSvg?: string;
    /** Annexes included for this step */
    annexes?: AnnexeId[];
    /** Manual steps inserted between lines of this computed step */
    inlineManualSteps?: Record<number, CarnetStep>;
}

export type NavLanguage = 'Horaire' | 'Cardinaux' | 'Azimut' | 'Tournant';

export interface POIResult {
    id: string;
    name: string;
    type: string; // e.g. "bakery", "church", "landmark"
    selected: boolean;
    lat: number;
    lon: number;
}

/** Known module identifiers (matches legacy/modules/ directory names) */
export type ModuleId =
    | 'morse'
    | 'vigenere'
    | 'polybe'
    | 'gilwell'
    | 'avocat'
    | 'drapeaux'
    | 'maritime'
    | 'cassis'
    | 'templier'
    | 'texte_clair'
    | 'carte_ign';

/** Known annexe identifiers */
export type AnnexeId =
    | 'alphabet_morse'
    | 'grille_polybe'
    | 'alphabet_gilwell'
    | 'tableau_vigenere'
    | 'index_drapeaux'
    | 'methode_avocat'
    | 'code_templier';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTRAINT WARNINGS
// ─────────────────────────────────────────────────────────────────────────────

export type WarningSeverity = 'error' | 'warning' | 'info';

export interface ConstraintWarning {
    id: string;
    stepId: string;
    severity: WarningSeverity;
    rule: string;
    message: string;
    /** Human-readable explanation of the violated rule */
    detail?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORT QUEUE
// ─────────────────────────────────────────────────────────────────────────────

export type ExportFormat = 'pdf' | 'html' | 'docx' | 'csv';
export type ExportStatus = 'pending' | 'computing' | 'done' | 'error';

export interface ExportJob {
    id: string;
    format: ExportFormat;
    status: ExportStatus;
    /** Label shown in the queue (e.g. "Carnet Contrebandier — PDF") */
    label: string;
    /** 0–100 */
    progress: number;
    /** Estimated seconds remaining */
    etaSeconds?: number;
    /** Output file size in bytes (once done) */
    fileSizeBytes?: number;
    /** Effective export duration in ms (once done) */
    durationMs?: number;
    /** Error message if status === 'error' */
    error?: string;
    createdAt: number;
    completedAt?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// BACKGROUND JOB QUEUE
// ─────────────────────────────────────────────────────────────────────────────

export type JobType = 'route_leg' | 'azimut_leg' | 'poi_search' | 'carnet_update' | 'encoding';
export type JobPriority = 0 | 1 | 2 | 3 | 4; // 0=route_leg, 1=azimut, 2=poi, 3=carnet, 4=encoding

export interface BackgroundJob {
    id: string;
    type: JobType;
    priority: JobPriority;
    data: any;
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS (UI-ONLY)
// ─────────────────────────────────────────────────────────────────────────────

export interface Notification {
    id: string;
    message: string;
    type: 'info' | 'warning' | 'error';
    expiresAt: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// APP-LEVEL STATE
// ─────────────────────────────────────────────────────────────────────────────

export type AppMode = 'map' | 'textual';
export type CarnetView = 'participant' | 'solution';

export interface AppState {
    version: string;
    active_mode: AppMode;

    // Multi-route model
    routes: RouteDict[];
    active_route_id: string | null;
    route_chain: string[];

    // Stages (user waypoints A, B, C…)
    stages: Stage[];

    // GeoJSON data (merged route geometry)
    geojson_data: any | null;

    // Polygonalisation
    polygonalization_settings: PolygonalisationSettings;
    polygonal_steps: PolySegment[];
    polygonal_legs: Record<string, PolySegment[]>;
    pending_azimut_legs: string[];

    // Module assignments & language overrides
    distribution_mode: 'auto' | 'manual';
    active_preset_id: string;
    custom_assignments: Record<string, string>;
    custom_languages: Record<string, NavLanguage>;

    // UI
    active_tool: string;
    anchor_stage_idx: number; // -1 = no anchor, ≥0 = insert after this stage index
    show_azimuth_arrows: boolean;
    active_ign_layer: string;
    mapy_api_key: string;
    ign_api_key: string;
    small_roads_only: boolean;
    show_pois_on_map: boolean;
    show_dangers_on_map: boolean;
    show_stages_on_map: boolean;

    // Persisted POI tracking per segment
    segment_pois: Record<string, POIResult[]>;

    // Theme
    theme_id: string;
    theme_overrides: Record<string, string>;

    // Carnet / Textual mode
    carnet_steps: CarnetStep[];
    carnet_view: CarnetView;
    carnet_include_general_map: boolean;
    enabled_annexes: AnnexeId[];

    // Export
    export_queue: ExportJob[];

    // UI transient state (not persisted in .scoutproj)
    is_loading: boolean;
    loading_text: string;
    notifications: Notification[];
}
