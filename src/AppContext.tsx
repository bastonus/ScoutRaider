import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import type {
    AppState, RouteDict, PolySegment, PresetData, CarnetStep,
    ModuleId, AnnexeId, CarnetView, Stage, PolygonalisationSettings, Notification,
    Itinerary, AnnotationLayerDef, PointAnnotation, AreaAnnotation, DrawAnnotation, DrawStroke,
    TextAnnotation, TextItem
} from './logic/types';
import { StateManager } from './logic/StateManager';
import { presetsManager } from './logic/PresetsManager';
import { themeManager } from './logic/ThemeManager';
import { Orchestrator } from './logic/Orchestrator';
import { CarnetEngine } from './logic/CarnetEngine';
import { ConstraintChecker } from './logic/ConstraintChecker';
import { NavigationText } from './logic/NavigationText';
import { ModuleLogic } from './logic/ModuleLogic';
import { backgroundEngine } from './logic/BackgroundEngine';
import { calculatePolygonArea, formatArea, calculatePathLengthLonLat } from './logic/GeoUtils';

// ── Helper: build display polygon from control vertices + per-edge BRouter paths ──
// edgeRoutes[i] = detailed path from coords[i] → coords[(i+1)%n], or null for straight
export function buildAreaDisplayCoords(
    coords: [number, number][],
    edgeRoutes?: ([number, number][] | null)[]
): [number, number][] {
    if (!coords || coords.length < 2) return coords || [];
    if (!edgeRoutes || edgeRoutes.every(e => !e)) return coords;
    const n = coords.length;
    const result: [number, number][] = [];
    for (let i = 0; i < n; i++) {
        const edge = edgeRoutes[i];
        if (edge && edge.length >= 2) {
            // Add all points of this edge except the last (which is the next vertex)
            result.push(...edge.slice(0, -1));
        } else {
            result.push(coords[i]);
        }
    }
    return result.length >= 3 ? result : coords;
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTION TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type AppAction =
    // Mode & Tool
    | { type: 'SET_MODE'; mode: 'map' | 'textual' }
    | { type: 'SET_ACTIVE_TOOL'; tool: string }

    // Route management
    | { type: 'ADD_ROUTE'; route: RouteDict; insertIdx?: number }
    | { type: 'UPDATE_ROUTE'; id: string; updater: (r: RouteDict) => RouteDict }
    | { type: 'SWAP_ROUTE_ALTERNATIVE'; id: string; altIdx: number }
    | { type: 'REMOVE_ROUTE'; id: string }

    // Stage management
    | { type: 'ADD_STAGE'; lat: number; lon: number; label: string; address?: string; id?: string }
    | { type: 'INSERT_STAGE'; afterIdx: number; lat: number; lon: number; id?: string }
    | { type: 'REMOVE_STAGE'; id: string }
    | { type: 'MOVE_STAGE'; id: string; lat: number; lon: number; address?: string }
    | { type: 'REORDER_STAGES'; stages: Stage[] }
    | { type: 'INVERT_ROUTE' }
    | { type: 'SET_ANCHOR_STAGE'; idx: number }

    // Multi-itinerary management (Layer Manager)
    | { type: 'ADD_ITINERARY'; name?: string; color?: string; duplicateCurrent?: boolean }
    | { type: 'SET_ACTIVE_ITINERARY'; id: string }
    | { type: 'TOGGLE_ITINERARY_VISIBILITY'; id: string }
    | { type: 'UPDATE_ITINERARY'; id: string; name?: string; color?: string }
    | { type: 'REMOVE_ITINERARY'; id: string }
    | { type: 'DUPLICATE_ITINERARY'; id: string }

    // Annotations & distinct annotation layers
    | { type: 'ADD_POINT_ANNOTATION'; point: Omit<PointAnnotation, 'id' | 'createdAt'> }
    | { type: 'UPDATE_POINT_ANNOTATION'; id: string; patch: Partial<PointAnnotation> }
    | { type: 'REMOVE_POINT_ANNOTATION'; id: string }
    | { type: 'TOGGLE_POINT_VISIBILITY'; id: string }
    | { type: 'ADD_AREA_ANNOTATION'; area: Omit<AreaAnnotation, 'id' | 'createdAt'> }
    | { type: 'UPDATE_AREA_ANNOTATION'; id: string; patch: Partial<AreaAnnotation> }
    | { type: 'REMOVE_AREA_ANNOTATION'; id: string }
    | { type: 'DELETE_AREA_VERTEX'; areaId: string; vertexIdx: number }
    | { type: 'SET_AREA_ROUTED_COORDS'; areaId: string; routedCoords: [number, number][]; area_m2: number; formatted_area: string }
    | { type: 'TOGGLE_AREA_VISIBILITY'; id: string }
    | { type: 'TOGGLE_ANNOTATION_LAYER_VISIBILITY'; layerId: string }
    | { type: 'ADD_ANNOTATION_LAYER'; name: string; color?: string; layerType?: 'points' | 'areas' | 'mixed' }
    | { type: 'REMOVE_ANNOTATION_LAYER'; layerId: string }
    // Draw (brush) annotations
    | { type: 'ADD_DRAW_ANNOTATION'; draw: Omit<DrawAnnotation, 'id' | 'createdAt'> }
    | { type: 'UPDATE_DRAW_ANNOTATION'; id: string; patch: Partial<DrawAnnotation> }
    | { type: 'APPEND_DRAW_STROKE'; id: string; stroke: DrawStroke }
    | { type: 'UPDATE_DRAW_STROKE'; drawId: string; strokeId: string; patch: Partial<DrawStroke> }
    | { type: 'REMOVE_DRAW_STROKE'; drawId: string; strokeId: string }
    | { type: 'REMOVE_DRAW_ANNOTATION'; id: string }
    | { type: 'TOGGLE_DRAW_VISIBILITY'; id: string }
    // Text annotations
    | { type: 'ADD_TEXT_ANNOTATION'; text: Omit<TextAnnotation, 'id' | 'createdAt'> }
    | { type: 'UPDATE_TEXT_ANNOTATION'; id: string; patch: Partial<TextAnnotation> }
    | { type: 'APPEND_TEXT_ITEM'; id: string; textItem: TextItem }
    | { type: 'UPDATE_TEXT_ITEM'; textId: string; itemId: string; patch: Partial<TextItem> }
    | { type: 'REMOVE_TEXT_ITEM'; textId: string; itemId: string }
    | { type: 'REMOVE_TEXT_ANNOTATION'; id: string }
    | { type: 'TOGGLE_TEXT_VISIBILITY'; id: string }

    // Panel layer selection
    | { type: 'SET_SELECTED_LAYER'; id: string | null }
    | { type: 'SET_SELECTED_SUBLAYER'; layerId: string | null; sublayerId: string | null }
    // Layer display order (persisted)
    | { type: 'SET_LAYER_ORDER'; order: Array<{ kind: 'itin' | 'point' | 'area' | 'draw' | 'text'; id: string }>; recordHistory?: boolean }

    // Polygonalisation
    | { type: 'SET_POLYGONAL_LEGS'; legKey: string; segments: PolySegment[] }
    | { type: 'SET_POLYGONAL_STEPS'; steps: PolySegment[] }
    | { type: 'SET_POLYGONAL_SETTINGS'; settings: Partial<PolygonalisationSettings> }

    // Node & Azimut editing (Phase 0 fixes)
    | { type: 'UPDATE_AZIMUT'; segIdx: number; azimut: number }
    | { type: 'TOGGLE_NODE'; nodeIdx: number; mode: 'mask' | 'force' }

    // Module assignment (Metro Timeline + Encoding tool)
    | { type: 'ASSIGN_MODULES_RANGE'; startIdx: number; endIdx: number; moduleId: string }
    | { type: 'SET_CUSTOM_ASSIGNMENTS'; assignments: Record<string, string> }

    // Carnet / Textual mode
    | { type: 'REBUILD_CARNET' }
    | { type: 'TOGGLE_ANNEXE'; annexeId: AnnexeId }
    | { type: 'SET_CARNET_VIEW'; view: CarnetView }
    | { type: 'TOGGLE_GENERAL_MAP' }
    | { type: 'TOGGLE_ELEVATION_PROFILE' }
    | { type: 'MANUAL_MODULE_ASSIGNMENT'; stepId: string; moduleId: string }
    | { type: 'UPDATE_MANUAL_TEXT'; stepId: string; text: string }
    | { type: 'INSERT_MANUAL_STEP'; afterStepId: string; content: string }
    /** New 2-button separator: insert a typed manual block (html or code) */
    | { type: 'INSERT_MANUAL_STEP_TYPED'; afterStepId: string; content: string; manualType: 'html' | 'code'; moduleId?: string; anchorSegmentIdx?: number }
    | { type: 'REMOVE_MANUAL_STEP'; stepId: string }
    | { type: 'SET_NAV_LANGUAGE'; stepId?: string; segIdx?: number; lang: CarnetStep['navLanguage'] }
    | { type: 'TOGGLE_POI'; stepId?: string; segIdx?: number; poiId: string }
    | { type: 'TOGGLE_POIS_ON_MAP' }
    | { type: 'TOGGLE_DANGERS_ON_MAP' }
    | { type: 'TOGGLE_STAGES_ON_MAP' }
    /**
     * Edit the plain-text of a computed (non-manual) step.
     * The new text is validated (±10% distance/azimuth tolerance) and re-encoded.
     * Sets isEdited=true to suppress constraint warnings.
     */
    | { type: 'EDIT_COMPUTED_TEXT'; stepId: string; lineIdx?: number; newSolutionText: string }
    /** Persist the zoom/center/bounds of a carte_ign or drapeaux mini-map */
    | {
        type: 'PERSIST_MAP_STATE';
        stepId: string;
        zoom?: number;
        center?: [number, number];
        bounds?: [[number, number], [number, number]];
        height?: number;
        width?: number;
        widthPercent?: number;
        alignment?: 'left' | 'center' | 'right';
        scaleName?: string;
        layerId?: string;
        isLocked?: boolean;
        showRoute?: boolean;
        showEndpoints?: boolean;
        showAnnotations?: boolean;
    }

    // POI persistence
    | { type: 'SET_SEGMENT_POIS'; segment_pois: Record<string, import('./logic/types').POIResult[]> }

    // Configuration
    | { type: 'SET_THEME'; themeId: string }
    | { type: 'SET_PRESET'; presetId: string }
    | { type: 'SET_SMALL_ROADS'; enabled: boolean }
    | { type: 'SET_IGN_LAYER'; layer: string }
    | { type: 'SET_MAP_API_KEYS'; mapyKey?: string; ignKey?: string }
    | { type: 'SET_AUTO_CHECK_UPDATES'; enabled: boolean }

    // Persistence
    | { type: 'UNDO' }
    | { type: 'REDO' }
    | { type: 'SET_DOCUMENT_TITLE'; title: string }
    | { type: 'SET_CURRENT_FILEPATH'; filepath: string | null }
    | { type: 'LOAD_PROJECT'; state: AppState }
    | { type: 'NEW_PROJECT' }

    // UI transient
    | { type: 'SET_LOADING'; isLoading: boolean; text?: string }
    | { type: 'ADD_NOTIFICATION'; message: string; notifType: 'info' | 'warning' | 'error'; duration?: number }
    | { type: 'REMOVE_NOTIFICATION'; id: string };

// ─────────────────────────────────────────────────────────────────────────────
// INITIAL STATE
// ─────────────────────────────────────────────────────────────────────────────

const initialState: AppState = {
    ...StateManager.getInitialState(),
    is_loading: false,
    loading_text: '',
    notifications: [],
    selected_layer_id: 'itin-1',
    selected_sublayer_id: null,
};

// ─────────────────────────────────────────────────────────────────────────────
// UNDO / REDO STACKS (module-level, outside reducer for mutability)
// ─────────────────────────────────────────────────────────────────────────────

const MAX_HISTORY = 50;
let historyStack: AppState[] = [];
let redoStack: AppState[] = [];

/** Push a snap of the current state before a mutation (call before returning new state) */
function pushHistory(state: AppState) {
    // Strip transient UI fields to avoid bloating the stack
    const snap = { ...state, notifications: [], is_loading: false, loading_text: '' };
    historyStack.push(snap);
    if (historyStack.length > MAX_HISTORY) historyStack.shift();
    redoStack = []; // any new action clears redo
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY LAYERS AUTO-CLEANUP
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Automatically purges empty layers when leaving their editing tool:
 * - Empty itineraries (0 stages & 0 manual steps) when leaving route tools
 * - Empty draw annotations (0 strokes or all strokes < 2 pts) when leaving draw tool
 * - Incomplete area annotations (< 3 coords) when leaving area tool
 * - Invalid point annotations (< 2 coords) when leaving point tool
 * - All empty layers across all kinds when switching mode (e.g. Map -> Textual/Carnet)
 */
function cleanupEmptyLayers(state: AppState, incomingTool?: string): AppState {
    const isIncomingRoute = incomingTool ? ['route', 'route_direct', 'node', 'azimut'].includes(incomingTool) : false;
    const isIncomingDraw = incomingTool === 'annotate_draw';
    const isIncomingText = incomingTool === 'annotate_text';
    const isIncomingArea = incomingTool ? ['annotate_area', 'annotate_area_routed'].includes(incomingTool) : false;
    const isIncomingPoint = incomingTool === 'annotate_point';

    // 1. Sync live active itinerary stages before checking
    const syncedItins = (state.itineraries || []).map(it => it.id === state.active_itinerary_id ? {
        ...it,
        stages: state.stages || [],
        routes: state.routes || [],
        polygonal_steps: state.polygonal_steps || [],
        polygonal_legs: state.polygonal_legs || {},
        carnet_steps: state.carnet_steps || [],
        custom_assignments: state.custom_assignments || {},
        custom_languages: state.custom_languages || {},
    } : it);

    // If incoming tool is NOT route, empty itineraries must be purged
    const validItins = isIncomingRoute
        ? syncedItins
        : syncedItins.filter(it => (it.stages?.length || 0) > 0 || ((it as any).manual_steps?.length || 0) > 0 || (it.polygonal_steps?.length || 0) > 0);
    const removedItinIds = new Set(syncedItins.filter(it => !validItins.includes(it)).map(it => it.id));

    // If incoming tool is NOT draw, empty draw annotations must be purged
    const allDraws = state.draw_annotations || [];
    const validDraws = isIncomingDraw
        ? allDraws
        : allDraws.filter(d => d.strokes && d.strokes.length > 0 && d.strokes.some(s => s.points && s.points.length >= 2));
    const removedDrawIds = new Set(allDraws.filter(d => !validDraws.includes(d)).map(d => d.id));

    // If incoming tool is NOT text, empty text annotations must be purged
    const allTexts = state.text_annotations || [];
    const validTexts = isIncomingText
        ? allTexts
        : allTexts.filter(t => t.texts && t.texts.length > 0 && t.texts.some(item => item.text && item.text.trim().length > 0));
    const removedTextIds = new Set(allTexts.filter(t => !validTexts.includes(t)).map(t => t.id));

    // If incoming tool is NOT area, incomplete area annotations (< 3 coords) must be purged
    const allAreas = state.area_annotations || [];
    const validAreas = isIncomingArea
        ? allAreas
        : allAreas.filter(a => a.coords && a.coords.length >= 3);
    const removedAreaIds = new Set(allAreas.filter(a => !validAreas.includes(a)).map(a => a.id));

    // If incoming tool is NOT point, invalid points must be purged
    const allPoints = state.point_annotations || [];
    const validPoints = isIncomingPoint
        ? allPoints
        : allPoints.filter(p => p.coords && p.coords.length >= 2);
    const removedPointIds = new Set(allPoints.filter(p => !validPoints.includes(p)).map(p => p.id));

    const totalRemoved = removedItinIds.size + removedDrawIds.size + removedTextIds.size + removedAreaIds.size + removedPointIds.size;
    if (totalRemoved === 0) {
        return { ...state, itineraries: syncedItins };
    }

    // Clean layer_order
    const nextLayerOrder = (state.layer_order || []).filter(item => {
        if (item.kind === 'itin' && removedItinIds.has(item.id)) return false;
        if (item.kind === 'draw' && removedDrawIds.has(item.id)) return false;
        if (item.kind === 'text' && removedTextIds.has(item.id)) return false;
        if (item.kind === 'area' && removedAreaIds.has(item.id)) return false;
        if (item.kind === 'point' && removedPointIds.has(item.id)) return false;
        return true;
    });

    let nextActiveItinId = state.active_itinerary_id;
    let nextSelectedLayerId = state.selected_layer_id;
    let nextStages = state.stages;
    let nextRoutes = state.routes;
    let nextPolySteps = state.polygonal_steps;
    let nextPolyLegs = state.polygonal_legs;
    let nextCarnet = state.carnet_steps;
    let nextCustomAssignments = state.custom_assignments;
    let nextCustomLangs = state.custom_languages;
    let nextAnchor = state.anchor_stage_idx;

    if (removedItinIds.has(state.active_itinerary_id || '')) {
        if (validItins.length > 0) {
            const first = validItins[0];
            nextActiveItinId = first.id;
            if (nextSelectedLayerId === state.active_itinerary_id) {
                nextSelectedLayerId = first.id;
            }
            nextStages = first.stages || [];
            nextRoutes = first.routes || [];
            nextPolySteps = first.polygonal_steps || [];
            nextPolyLegs = first.polygonal_legs || {};
            nextCarnet = first.carnet_steps || [];
            nextCustomAssignments = first.custom_assignments || {};
            nextCustomLangs = first.custom_languages || {};
            nextAnchor = (first.stages?.length || 0) - 1;
        } else {
            nextActiveItinId = null as any;
            if (removedItinIds.has(nextSelectedLayerId || '')) {
                nextSelectedLayerId = null;
            }
            nextStages = [];
            nextRoutes = [];
            nextPolySteps = [];
            nextPolyLegs = {};
            nextCarnet = [];
            nextCustomAssignments = {};
            nextCustomLangs = {};
            nextAnchor = -1;
        }
    }

    if (removedDrawIds.has(nextSelectedLayerId || '') ||
        removedTextIds.has(nextSelectedLayerId || '') ||
        removedAreaIds.has(nextSelectedLayerId || '') ||
        removedPointIds.has(nextSelectedLayerId || '')) {
        nextSelectedLayerId = null;
    }

    return {
        ...state,
        itineraries: validItins,
        draw_annotations: validDraws,
        text_annotations: validTexts,
        area_annotations: validAreas,
        point_annotations: validPoints,
        layer_order: nextLayerOrder,
        active_itinerary_id: nextActiveItinId,
        selected_layer_id: nextSelectedLayerId,
        stages: nextStages,
        routes: nextRoutes,
        polygonal_steps: nextPolySteps,
        polygonal_legs: nextPolyLegs,
        carnet_steps: nextCarnet,
        custom_assignments: nextCustomAssignments,
        custom_languages: nextCustomLangs,
        anchor_stage_idx: nextAnchor,
    };
}

/**
 * Keep the routes persisted on the active itinerary in sync with the live
 * `state.routes`. Route legs are added/updated asynchronously after the stage,
 * so without this the stored itinerary keeps `null` legs and the layer panel
 * displays a wrong (0 km) distance for it once it is no longer active.
 */
function syncActiveItineraryRoutes(state: AppState): AppState {
    const activeId = state.active_itinerary_id;
    if (!activeId) return state;
    return {
        ...state,
        itineraries: (state.itineraries || []).map(it =>
            it.id === activeId ? { ...it, routes: state.routes } : it
        ),
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// REDUCER
// ─────────────────────────────────────────────────────────────────────────────

function appReducer(state: AppState, action: AppAction): AppState {
    switch (action.type) {

        // ── Mode & Tool ────────────────────────────────────────────────────
        case 'SET_MODE': {
            const cleaned = cleanupEmptyLayers(state);
            return { ...cleaned, active_mode: action.mode };
        }

        case 'SET_ACTIVE_TOOL': {
            const cleaned = cleanupEmptyLayers(state, action.tool);
            return {
                ...cleaned,
                active_tool: action.tool,
                anchor_stage_idx: -1,
            };
        }

        case 'SET_ANCHOR_STAGE':
            return { ...state, anchor_stage_idx: action.idx };

        // ── Stage management ───────────────────────────────────────────────
        case 'ADD_STAGE': {
            pushHistory(state);
            const anchorIdx = state.anchor_stage_idx;
            const newStage: Stage = {
                id: action.id || `stage-${Date.now()}`,
                coords: [action.lat, action.lon],
                label: '-',
                address: action.address
            };
            let newStages: Stage[];
            let newRoutes = [...state.routes];
            if (anchorIdx >= 0 && anchorIdx < state.stages.length) {
                // Insert after anchor index (legacy insertion mode)
                newStages = [...state.stages];
                newStages.splice(anchorIdx + 1, 0, newStage);
                newRoutes.splice(anchorIdx + 1, 0, null as any);
            } else {
                newStages = [...state.stages, newStage];
                if (state.stages.length > 0) newRoutes.push(null as any);
            }
            // Re-label sequentially A, B, C…
            const labeledStages = newStages.map((s, i) => ({ ...s, label: String.fromCharCode(65 + i) }));
            const newAnchor = labeledStages.length - 1;

            // Sync into active itinerary in itineraries list immediately
            const activeId = state.active_itinerary_id;
            const updatedItins = (state.itineraries || []).map(it => it.id === activeId ? {
                ...it,
                stages: labeledStages,
                routes: newRoutes,
            } : it);

            return {
                ...state,
                itineraries: updatedItins,
                stages: labeledStages,
                routes: newRoutes,
                anchor_stage_idx: newAnchor,
                selected_layer_id: activeId || state.selected_layer_id,
            };
        }

        case 'INSERT_STAGE': {
            pushHistory(state);
            const newStage: Stage = {
                id: action.id || `stage-${Date.now()}`,
                coords: [action.lat, action.lon],
                label: '-'
            };
            const inserted = [...state.stages];
            inserted.splice(action.afterIdx + 1, 0, newStage);
            const newRoutes = [...state.routes];
            newRoutes.splice(action.afterIdx + 1, 0, null as any);
            const relabeled = inserted.map((s, i) => ({ ...s, label: String.fromCharCode(65 + i) }));
            const activeId = state.active_itinerary_id;
            const updatedItins = (state.itineraries || []).map(it => it.id === activeId ? {
                ...it,
                stages: relabeled,
                routes: newRoutes,
            } : it);
            return {
                ...state,
                itineraries: updatedItins,
                stages: relabeled,
                routes: newRoutes,
                anchor_stage_idx: relabeled.length - 1,
                selected_layer_id: activeId || state.selected_layer_id,
            };
        }

        case 'REMOVE_STAGE': {
            pushHistory(state);
            const idx = state.stages.findIndex(s => s.id === action.id);
            if (idx === -1) return state;
            const newStages = state.stages.filter(s => s.id !== action.id);
            // Re-label remaining stages A, B, C...
            const relabeled = newStages.map((s, i) => ({
                ...s,
                label: String.fromCharCode(65 + i)
            }));
            // Remove associated route legs to keep routes perfectly aligned (length = stages.length - 1)
            const newRoutes = [...state.routes];
            if (idx > 0 && idx < state.stages.length - 1) {
                // Removing middle stage: the two surrounding routes merge into one.
                newRoutes.splice(idx, 1);
                newRoutes[idx - 1] = null as any; // awaiting bridge route
            } else if (idx === 0 && newRoutes.length > 0) {
                newRoutes.splice(0, 1); // remove first leg
            } else if (idx > 0 && idx === state.stages.length - 1 && newRoutes.length > 0) {
                newRoutes.splice(idx - 1, 1); // remove last leg
            }
            const activeId = state.active_itinerary_id;
            const updatedItins = (state.itineraries || []).map(it => it.id === activeId ? {
                ...it,
                stages: relabeled,
                routes: newRoutes,
            } : it);
            return {
                ...state,
                itineraries: updatedItins,
                stages: relabeled,
                routes: newRoutes,
                selected_layer_id: activeId || state.selected_layer_id,
            };
        }

        case 'MOVE_STAGE': {
            pushHistory(state);
            const movedStages = state.stages.map(s =>
                s.id === action.id ? { ...s, coords: [action.lat, action.lon], address: action.address !== undefined ? action.address : s.address } : s
            );
            const activeId = state.active_itinerary_id;
            const updatedItins = (state.itineraries || []).map(it => it.id === activeId ? {
                ...it,
                stages: movedStages,
            } : it);
            return {
                ...state,
                itineraries: updatedItins,
                stages: movedStages,
                selected_layer_id: activeId || state.selected_layer_id,
            };
        }

        case 'REORDER_STAGES': {
            pushHistory(state);
            // Re-label in order
            const reordered = action.stages.map((s, i) => ({
                ...s,
                label: String.fromCharCode(65 + i)
            }));
            return { ...state, stages: reordered, routes: [] }; // routes need full recalc
        }

        case 'INVERT_ROUTE': {
            pushHistory(state);
            const inverted = [...state.stages].reverse().map((s, i) => ({
                ...s,
                label: String.fromCharCode(65 + i)
            }));
            return { ...state, stages: inverted, routes: [] }; // routes need full recalc
        }

        // ── Multi-itinerary management (Layer Manager) ────────────────────
        case 'ADD_ITINERARY': {
            pushHistory(state);
            const existing = state.itineraries || [];
            const colors = ['#2d8ceb', '#f97316', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#eab308'];

            // Numbering must not be derived from the array length alone: empty
            // itineraries are pruned, so the length can stay the same and two
            // consecutive creations would both be named "Itinéraire 2" with the
            // same color. Pick the first free number/color instead.
            const usedNames = new Set(existing.map(i => i.name));
            let n = existing.length + 1;
            while (usedNames.has(`Itinéraire ${n}`)) n++;

            const usedColors = new Set(existing.map(i => i.color));
            const name = action.name || `Itinéraire ${n}`;
            const color = action.color
                || colors.find(c => !usedColors.has(c))
                || colors[(n - 1) % colors.length];
            const newId = `itin-${Date.now()}`;

            let newItin: Itinerary;
            if (action.duplicateCurrent) {
                newItin = {
                    id: newId,
                    name: action.name || `${state.itineraries?.find(i => i.id === state.active_itinerary_id)?.name || 'Itinéraire'} (Variante)`,
                    color,
                    visible: true,
                    stages: state.stages.map(s => ({ ...s })),
                    routes: state.routes.map(r => r ? ({ ...r }) : r),
                    polygonal_steps: [...state.polygonal_steps],
                    polygonal_legs: { ...state.polygonal_legs },
                    carnet_steps: [...state.carnet_steps],
                    custom_assignments: { ...(state.custom_assignments || {}) },
                    custom_languages: { ...(state.custom_languages || {}) }
                };
            } else {
                newItin = {
                    id: newId,
                    name,
                    color,
                    visible: true,
                    stages: [],
                    routes: [],
                    polygonal_steps: [],
                    polygonal_legs: {},
                    carnet_steps: [],
                    custom_assignments: {},
                    custom_languages: {}
                };
            }

            // If current active itinerary was empty, prune it so empty ones don't accumulate
            const currentSavedItins = (state.itineraries || [])
                .filter(it => it.id !== state.active_itinerary_id || (state.stages && state.stages.length > 0) || ((it as any).manual_steps?.length || 0) > 0 || (it.polygonal_steps?.length || 0) > 0)
                .map(it => it.id === state.active_itinerary_id ? {
                    ...it,
                    stages: state.stages,
                    routes: state.routes,
                    polygonal_steps: state.polygonal_steps,
                    polygonal_legs: state.polygonal_legs,
                    carnet_steps: state.carnet_steps,
                    custom_assignments: state.custom_assignments,
                    custom_languages: state.custom_languages,
                } : it);

            const allItins = [...currentSavedItins, newItin];

            const nextLayerOrder = [
                ...(state.layer_order || []).filter(item => item.kind !== 'itin' || currentSavedItins.some(i => i.id === item.id)),
                { kind: 'itin' as const, id: newId }
            ];

            return {
                ...state,
                itineraries: allItins,
                layer_order: nextLayerOrder,
                active_itinerary_id: newId,
                selected_layer_id: newId,
                active_tool: 'route',
                stages: newItin.stages,
                routes: newItin.routes,
                polygonal_steps: newItin.polygonal_steps,
                polygonal_legs: newItin.polygonal_legs,
                carnet_steps: newItin.carnet_steps,
                custom_assignments: newItin.custom_assignments || {},
                custom_languages: newItin.custom_languages || {},
                anchor_stage_idx: -1
            };
        }

        case 'SET_ACTIVE_ITINERARY': {
            // Save current active state before switching
            const updatedItins = (state.itineraries || []).map(it => it.id === state.active_itinerary_id ? {
                ...it,
                stages: state.stages,
                routes: state.routes,
                polygonal_steps: state.polygonal_steps,
                polygonal_legs: state.polygonal_legs,
                carnet_steps: state.carnet_steps,
                custom_assignments: state.custom_assignments,
                custom_languages: state.custom_languages,
            } : it);

            const target = updatedItins.find(it => it.id === action.id);
            if (!target) return { ...state, itineraries: updatedItins };

            return {
                ...state,
                itineraries: updatedItins,
                active_itinerary_id: target.id,
                selected_layer_id: target.id,
                active_tool: 'route',
                stages: target.stages || [],
                routes: target.routes || [],
                polygonal_steps: target.polygonal_steps || [],
                polygonal_legs: target.polygonal_legs || {},
                carnet_steps: target.carnet_steps || [],
                custom_assignments: target.custom_assignments || {},
                custom_languages: target.custom_languages || {},
                anchor_stage_idx: (target.stages?.length || 0) - 1
            };
        }

        case 'TOGGLE_ITINERARY_VISIBILITY': {
            return {
                ...state,
                itineraries: (state.itineraries || []).map(it => it.id === action.id ? { ...it, visible: !it.visible } : it)
            };
        }

        case 'UPDATE_ITINERARY': {
            pushHistory(state);
            return {
                ...state,
                itineraries: (state.itineraries || []).map(it => {
                    if (it.id === action.id) {
                        return {
                            ...it,
                            ...(action.name ? { name: action.name } : {}),
                            ...(action.color ? { color: action.color } : {})
                        };
                    }
                    return it;
                })
            };
        }

        case 'REMOVE_ITINERARY': {
            pushHistory(state);
            const remaining = state.itineraries.filter(it => it.id !== action.id);
            const nextSelId = state.selected_layer_id === action.id ? null : state.selected_layer_id;

            // If the last itinerary is deleted, create a fresh default one
            if (remaining.length === 0) {
                const freshId = `itin-${Date.now()}`;
                const freshItin = {
                    id: freshId,
                    name: 'Itinéraire 1 (Principal)',
                    color: '#2d8ceb',
                    visible: true,
                    stages: [],
                    routes: [],
                    polygonal_steps: [],
                    polygonal_legs: {},
                    carnet_steps: {},
                    custom_assignments: {},
                    custom_languages: {},
                };
                return {
                    ...state,
                    itineraries: [freshItin],
                    active_itinerary_id: freshId,
                    selected_layer_id: freshId,
                    stages: [],
                    routes: [],
                    polygonal_steps: [],
                    polygonal_legs: {},
                    carnet_steps: [],
                    custom_assignments: {},
                    custom_languages: {},
                    anchor_stage_idx: -1,
                };
            }

            if (state.active_itinerary_id === action.id) {
                const nextActive = remaining[0];
                return {
                    ...state,
                    itineraries: remaining,
                    active_itinerary_id: nextActive.id,
                    selected_layer_id: nextSelId ?? nextActive.id,
                    stages: nextActive.stages || [],
                    routes: nextActive.routes || [],
                    polygonal_steps: nextActive.polygonal_steps || [],
                    polygonal_legs: nextActive.polygonal_legs || {},
                    carnet_steps: nextActive.carnet_steps || [],
                    custom_assignments: nextActive.custom_assignments || {},
                    custom_languages: nextActive.custom_languages || {},
                    anchor_stage_idx: -1
                };
            }
            return { ...state, itineraries: remaining, selected_layer_id: nextSelId };
        }

        case 'DUPLICATE_ITINERARY': {
            pushHistory(state);
            const source = (state.itineraries || []).find(it => it.id === action.id);
            if (!source) return state;
            const newId = `itin-${Date.now()}`;
            const colors = ['#2d8ceb', '#f97316', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#eab308'];
            const color = colors[state.itineraries.length % colors.length];
            const duplicated: Itinerary = {
                ...source,
                id: newId,
                name: `${source.name} (Variante)`,
                color,
                visible: true,
                stages: source.stages.map(s => ({ ...s })),
                routes: source.routes.map(r => r ? ({ ...r }) : r),
                polygonal_steps: [...source.polygonal_steps],
                polygonal_legs: { ...source.polygonal_legs },
                carnet_steps: [...source.carnet_steps]
            };
            return {
                ...state,
                itineraries: [...state.itineraries, duplicated]
            };
        }

        // ── Annotations & Annotation Layers ───────────────────────────────
        case 'ADD_POINT_ANNOTATION': {
            pushHistory(state);
            const ptCount = (state.point_annotations?.length || 0) + 1;
            const newPoint: PointAnnotation = {
                id: (action.point as any).id || `poi-annot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                type: 'point',
                layerId: action.point.layerId || 'layer-points',
                title: action.point.title || `Repère ${ptCount}`,
                text: action.point.text || '',
                coords: action.point.coords,
                color: action.point.color || '#3b82f6',
                icon: action.point.icon || 'pin',
                visible: action.point.visible !== undefined ? action.point.visible : true,
                createdAt: Date.now()
            };
            return {
                ...state,
                point_annotations: [...(state.point_annotations || []), newPoint],
                selected_layer_id: newPoint.id,
            };
        }

        case 'UPDATE_POINT_ANNOTATION': {
            pushHistory(state);
            return {
                ...state,
                point_annotations: (state.point_annotations || []).map(p =>
                    p.id === action.id ? { ...p, ...action.patch } : p
                )
            };
        }

        case 'REMOVE_POINT_ANNOTATION': {
            pushHistory(state);
            return {
                ...state,
                point_annotations: (state.point_annotations || []).filter(p => p.id !== action.id),
                selected_layer_id: state.selected_layer_id === action.id ? null : state.selected_layer_id,
            };
        }

        case 'TOGGLE_POINT_VISIBILITY': {
            return {
                ...state,
                point_annotations: (state.point_annotations || []).map(p =>
                    p.id === action.id ? { ...p, visible: !p.visible } : p
                )
            };
        }

        case 'ADD_AREA_ANNOTATION': {
            pushHistory(state);
            const areaCount = (state.area_annotations?.length || 0) + 1;
            const m2 = calculatePolygonArea(action.area.coords);
            const areaColors = new Set((state.area_annotations || []).map(a => a.color));
            const colors = ['#10b981', '#f97316', '#2d8ceb', '#8b5cf6', '#ec4899', '#06b6d4', '#eab308'];
            const areaColor = action.area.color
                || colors.find(c => !areaColors.has(c))
                || colors[(areaCount - 1) % colors.length];
            const newArea: AreaAnnotation = {
                // Use provided id if any (allows caller to track it for updates)
                id: (action.area as any).id || `area-annot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                type: 'area',
                layerId: action.area.layerId || 'layer-areas',
                title: action.area.title || `Zone ${areaCount}`,
                text: action.area.text || '',
                coords: action.area.coords,
                color: areaColor,
                fillOpacity: action.area.fillOpacity ?? 0.25,
                visible: action.area.visible !== undefined ? action.area.visible : true,
                area_m2: m2,
                formatted_area: formatArea(m2),
                createdAt: Date.now()
            };
            return {
                ...state,
                area_annotations: [...(state.area_annotations || []), newArea],
                selected_layer_id: newArea.id,
            };
        }

        case 'UPDATE_AREA_ANNOTATION': {
            pushHistory(state);
            return {
                ...state,
                area_annotations: (state.area_annotations || []).map(a => {
                    if (a.id !== action.id) return a;
                    const updated = { ...a, ...action.patch };
                    if (action.patch.coords) {
                        const m2 = calculatePolygonArea(action.patch.coords);
                        updated.area_m2 = m2;
                        updated.formatted_area = formatArea(m2);
                    }
                    return updated;
                })
            };
        }

        case 'REMOVE_AREA_ANNOTATION': {
            pushHistory(state);
            return {
                ...state,
                area_annotations: (state.area_annotations || []).filter(a => a.id !== action.id),
                selected_layer_id: state.selected_layer_id === action.id ? null : state.selected_layer_id,
            };
        }

        case 'DELETE_AREA_VERTEX': {
            pushHistory(state);
            return {
                ...state,
                area_annotations: (state.area_annotations || []).map(a => {
                    if (a.id !== action.areaId) return a;
                    if (a.coords.length <= 3) return a; // Keep at least 3 points
                    const newCoords = a.coords.filter((_, idx) => idx !== action.vertexIdx);
                    const m2 = calculatePolygonArea(newCoords);
                    return {
                        ...a,
                        coords: newCoords,
                        routedCoords: undefined,
                        area_m2: m2,
                        formatted_area: formatArea(m2)
                    };
                })
            };
        }

        case 'SET_AREA_ROUTED_COORDS': {
            return {
                ...state,
                area_annotations: (state.area_annotations || []).map(a => {
                    if (a.id !== action.areaId) return a;
                    return {
                        ...a,
                        routedCoords: action.routedCoords,
                        area_m2: action.area_m2,
                        formatted_area: action.formatted_area
                    };
                })
            };
        }

        case 'TOGGLE_AREA_VISIBILITY': {
            return {
                ...state,
                area_annotations: (state.area_annotations || []).map(a =>
                    a.id === action.id ? { ...a, visible: !a.visible } : a
                )
            };
        }

        case 'ADD_DRAW_ANNOTATION': {
            pushHistory(state);
            const newDraw: DrawAnnotation = {
                ...action.draw,
                id: (action.draw as any).id || `draw-annot-${Date.now()}`,
                createdAt: Date.now(),
                strokes: action.draw.strokes ?? [],
            };
            return {
                ...state,
                draw_annotations: [...(state.draw_annotations || []), newDraw],
                selected_layer_id: newDraw.id,
            };
        }

        case 'UPDATE_DRAW_ANNOTATION': {
            pushHistory(state);
            return {
                ...state,
                draw_annotations: (state.draw_annotations || []).map(d =>
                    d.id === action.id ? { ...d, ...action.patch } : d
                )
            };
        }

        case 'APPEND_DRAW_STROKE': {
            pushHistory(state);
            // action.stroke is now a DrawStroke object
            const strokeObj: DrawStroke = action.stroke as unknown as DrawStroke;
            return {
                ...state,
                draw_annotations: (state.draw_annotations || []).map(d =>
                    d.id === action.id ? { ...d, strokes: [...d.strokes, strokeObj] } : d
                )
            };
        }

        case 'UPDATE_DRAW_STROKE': {
            pushHistory(state);
            return {
                ...state,
                draw_annotations: (state.draw_annotations || []).map(d => {
                    if (d.id !== action.drawId) return d;
                    return {
                        ...d,
                        strokes: d.strokes.map((s: DrawStroke) =>
                            s.id === action.strokeId ? { ...s, ...action.patch } : s
                        )
                    };
                })
            };
        }

        case 'REMOVE_DRAW_STROKE': {
            pushHistory(state);
            return {
                ...state,
                draw_annotations: (state.draw_annotations || []).map(d => {
                    if (d.id !== action.drawId) return d;
                    return { ...d, strokes: d.strokes.filter((s: DrawStroke) => s.id !== action.strokeId) };
                }),
                selected_sublayer_id: state.selected_sublayer_id === action.strokeId ? null : state.selected_sublayer_id,
            };
        }

        case 'REMOVE_DRAW_ANNOTATION': {
            pushHistory(state);
            return {
                ...state,
                draw_annotations: (state.draw_annotations || []).filter(d => d.id !== action.id),
                selected_layer_id: state.selected_layer_id === action.id ? null : state.selected_layer_id,
                selected_sublayer_id: state.selected_layer_id === action.id ? null : state.selected_sublayer_id,
            };
        }

        case 'TOGGLE_DRAW_VISIBILITY': {
            return {
                ...state,
                draw_annotations: (state.draw_annotations || []).map(d =>
                    d.id === action.id ? { ...d, visible: !d.visible } : d
                )
            };
        }

        // ── Text Annotations ──────────────────────────────────────────────
        case 'ADD_TEXT_ANNOTATION': {
            pushHistory(state);
            const newText: TextAnnotation = {
                ...action.text,
                id: (action.text as any).id || `text-annot-${Date.now()}`,
                createdAt: Date.now(),
                texts: action.text.texts ?? [],
            };
            return {
                ...state,
                text_annotations: [...(state.text_annotations || []), newText],
                selected_layer_id: newText.id,
            };
        }

        case 'UPDATE_TEXT_ANNOTATION': {
            pushHistory(state);
            return {
                ...state,
                text_annotations: (state.text_annotations || []).map(t =>
                    t.id === action.id ? { ...t, ...action.patch } : t
                )
            };
        }

        case 'APPEND_TEXT_ITEM': {
            pushHistory(state);
            return {
                ...state,
                text_annotations: (state.text_annotations || []).map(t =>
                    t.id === action.id ? { ...t, texts: [...t.texts, action.textItem] } : t
                )
            };
        }

        case 'UPDATE_TEXT_ITEM': {
            pushHistory(state);
            return {
                ...state,
                text_annotations: (state.text_annotations || []).map(t => {
                    if (t.id !== action.textId) return t;
                    return {
                        ...t,
                        texts: t.texts.map((item: TextItem) =>
                            item.id === action.itemId ? { ...item, ...action.patch } : item
                        )
                    };
                })
            };
        }

        case 'REMOVE_TEXT_ITEM': {
            pushHistory(state);
            return {
                ...state,
                text_annotations: (state.text_annotations || []).map(t => {
                    if (t.id !== action.textId) return t;
                    return { ...t, texts: t.texts.filter((item: TextItem) => item.id !== action.itemId) };
                }),
                selected_sublayer_id: state.selected_sublayer_id === action.itemId ? null : state.selected_sublayer_id,
            };
        }

        case 'REMOVE_TEXT_ANNOTATION': {
            pushHistory(state);
            return {
                ...state,
                text_annotations: (state.text_annotations || []).filter(t => t.id !== action.id),
                selected_layer_id: state.selected_layer_id === action.id ? null : state.selected_layer_id,
                selected_sublayer_id: state.selected_layer_id === action.id ? null : state.selected_sublayer_id,
            };
        }

        case 'TOGGLE_TEXT_VISIBILITY': {
            return {
                ...state,
                text_annotations: (state.text_annotations || []).map(t =>
                    t.id === action.id ? { ...t, visible: !t.visible } : t
                )
            };
        }

        case 'SET_LAYER_ORDER': {
            // Auto-synchronisation of newly created layers must not pollute undo history.
            if (action.recordHistory !== false) pushHistory(state);
            return {
                ...state,
                layer_order: action.order
            };
        }

        case 'SET_SELECTED_LAYER': {
            // Save current active itinerary state first
            const updatedItins = (state.itineraries || []).map(it => it.id === state.active_itinerary_id ? {
                ...it,
                stages: state.stages,
                routes: state.routes,
                polygonal_steps: state.polygonal_steps,
                polygonal_legs: state.polygonal_legs,
                carnet_steps: state.carnet_steps,
                custom_assignments: state.custom_assignments,
                custom_languages: state.custom_languages,
            } : it);

            const targetItin = updatedItins.find(it => it.id === action.id);
            if (targetItin) {
                // Only switch to route tool if we're not in an annotation/draw mode
                // (prevents draw tool from being interrupted by clicking a dashed itinerary line)
                const annotationTools = ['annotate_point', 'annotate_area', 'annotate_area_routed', 'annotate_draw', 'annotate_text'];
                const nextTool = annotationTools.includes(state.active_tool) ? state.active_tool : 'route';
                return {
                    ...state,
                    itineraries: updatedItins,
                    active_itinerary_id: targetItin.id,
                    selected_layer_id: targetItin.id,
                    selected_sublayer_id: null,
                    active_tool: nextTool,
                    stages: targetItin.stages || [],
                    routes: targetItin.routes || [],
                    polygonal_steps: targetItin.polygonal_steps || [],
                    polygonal_legs: targetItin.polygonal_legs || {},
                    carnet_steps: targetItin.carnet_steps || [],
                    custom_assignments: targetItin.custom_assignments || {},
                    custom_languages: targetItin.custom_languages || {},
                    anchor_stage_idx: (targetItin.stages?.length || 0) - 1
                };
            }

            return {
                ...state,
                itineraries: updatedItins,
                selected_layer_id: action.id,
                selected_sublayer_id: null,
            };
        }

        case 'SET_SELECTED_SUBLAYER': {
            return {
                ...state,
                selected_layer_id: action.layerId,
                selected_sublayer_id: action.sublayerId,
            };
        }

        case 'TOGGLE_ANNOTATION_LAYER_VISIBILITY': {
            const layer = (state.annotation_layers || []).find(l => l.id === action.layerId);
            if (!layer) return state;
            const newVis = !layer.visible;
            return {
                ...state,
                annotation_layers: (state.annotation_layers || []).map(l =>
                    l.id === action.layerId ? { ...l, visible: newVis } : l
                ),
                point_annotations: (state.point_annotations || []).map(p =>
                    p.layerId === action.layerId ? { ...p, visible: newVis } : p
                ),
                area_annotations: (state.area_annotations || []).map(a =>
                    a.layerId === action.layerId ? { ...a, visible: newVis } : a
                )
            };
        }

        case 'ADD_ANNOTATION_LAYER': {
            pushHistory(state);
            const newLayer: AnnotationLayerDef = {
                id: `layer-${Date.now()}`,
                name: action.name,
                type: action.layerType || 'mixed',
                visible: true,
                color: action.color || '#3b82f6',
                isDefault: false
            };
            return {
                ...state,
                annotation_layers: [...(state.annotation_layers || []), newLayer]
            };
        }

        case 'REMOVE_ANNOTATION_LAYER': {
            pushHistory(state);
            return {
                ...state,
                annotation_layers: (state.annotation_layers || []).filter(l => l.id !== action.layerId),
                point_annotations: (state.point_annotations || []).filter(p => p.layerId !== action.layerId),
                area_annotations: (state.area_annotations || []).filter(a => a.layerId !== action.layerId)
            };
        }

        // ── Route management ───────────────────────────────────────────────
        case 'ADD_ROUTE': {
            const newRoutes = [...state.routes];
            if (action.insertIdx !== undefined && action.insertIdx >= 0 && action.insertIdx < Math.max(1, state.stages.length)) {
                newRoutes[action.insertIdx] = action.route;
            } else {
                // Fallback (should not happen if mapped properly)
                newRoutes.push(action.route);
            }
            return syncActiveItineraryRoutes({ ...state, routes: newRoutes });
        }

        case 'UPDATE_ROUTE':
            return StateManager.updateRoute(state, action.id, action.updater);

        case 'SWAP_ROUTE_ALTERNATIVE': {
            pushHistory(state);
            return StateManager.updateRoute(state, action.id, r => {
                const alt = r.alternatives?.[action.altIdx];
                if (!alt) return r;
                return {
                    ...r,
                    distance_m: (alt as any).distance || r.distance_m,
                    geojson: {
                        type: "Feature",
                        properties: alt.geometry?.properties || {},
                        geometry: {
                            type: "LineString",
                            coordinates: alt.geometry?.coordinates || []
                        }
                    }
                };
            });
        }

        case 'REMOVE_ROUTE':
            return { ...state, routes: state.routes.map(r => r?.id === action.id ? (null as any) : r) };

        // ── Polygonalisation ───────────────────────────────────────────────
        case 'SET_POLYGONAL_LEGS': {
            const nextState = StateManager.setPolygonalSegments(state, action.legKey, action.segments);
            const rebuiltPolygonal = StateManager.rebuildPolygonalSteps(nextState);
            return autoRebuildCarnet(rebuiltPolygonal);
        }

        case 'SET_POLYGONAL_STEPS': {
            // Intelligent leg_key assignment: match each segment to a route in state.routes
            const enrichedSteps = action.steps.map((seg: any) => {
                if (seg.leg_key) return seg;
                
                // Find a route that contains the segment's first coordinate
                if (seg.coords && seg.coords.length > 0) {
                    const firstPt = seg.coords[0];
                    const matchingRoute = state.routes.find((r: any) => {
                        if (!r) return false;
                        const rCoords = r.geojson?.geometry?.coordinates || r.geojson?.coordinates || [];
                        return rCoords.some((rp: any) => Math.abs(rp[0] - firstPt[0]) < 0.0001 && Math.abs(rp[1] - firstPt[1]) < 0.0001);
                    });
                    if (matchingRoute) return { ...seg, leg_key: matchingRoute.id };
                }
                return seg;
            });

            // We do NOT clear segment_pois here, to prevent POIs from disappearing from the map.
            return autoRebuildCarnet({ ...state, polygonal_steps: enrichedSteps });
        }

        case 'SET_POLYGONAL_SETTINGS': {
            pushHistory(state);
            return {
                ...state,
                polygonalization_settings: {
                    ...state.polygonalization_settings,
                    ...action.settings
                }
            };
        }

        // ── Node & Azimut editing (Phase 0 fixes) ─────────────────────────
        case 'UPDATE_AZIMUT': {
            const updatedSteps = [...state.polygonal_steps];
            if (action.segIdx >= 0 && action.segIdx < updatedSteps.length) {
                updatedSteps[action.segIdx] = {
                    ...updatedSteps[action.segIdx],
                    azimut: action.azimut,
                    properties: {
                        ...updatedSteps[action.segIdx].properties,
                        azimut: action.azimut
                    }
                };
            }
            
            // Also update the carnet_step live so text reflects map changes
            const newCarnetSteps = state.carnet_steps.map(step => {
                if (!step.segmentIndices || !step.segmentIndices.includes(action.segIdx)) return step;
                
                // If it's the first segment of this group, we update the main step azimuth (for display)
                const isFirst = step.segmentIndices[0] === action.segIdx;
                const newAzimuth = isFirst ? action.azimut : step.azimuth;

                return regenerateStepTexts({ ...step, azimuth: newAzimuth }, { ...state, polygonal_steps: updatedSteps });
            });

            return { ...state, polygonal_steps: updatedSteps, carnet_steps: newCarnetSteps };
        }

        // (REBUILD_CARNET is handled below in the Carnet / Textual mode section)

        case 'TOGGLE_NODE': {
            pushHistory(state);
            const { nodeIdx, mode } = action;
            const settings = { ...state.polygonalization_settings };
            if (mode === 'mask') {
                settings.masked_nodes = settings.masked_nodes.includes(nodeIdx)
                    ? settings.masked_nodes.filter(n => n !== nodeIdx)
                    : [...settings.masked_nodes, nodeIdx];
            } else {
                settings.forced_nodes = settings.forced_nodes.includes(nodeIdx)
                    ? settings.forced_nodes.filter(n => n !== nodeIdx)
                    : [...settings.forced_nodes, nodeIdx];
            }
            return autoRebuildCarnet({ ...state, polygonalization_settings: settings });
        }

        // ── Module assignment ──────────────────────────────────────────────
        case 'ASSIGN_MODULES_RANGE': {
            pushHistory(state);
            const newAssignments = { ...state.custom_assignments };
            for (let i = action.startIdx; i <= action.endIdx; i++) {
                newAssignments[i.toString()] = action.moduleId;
            }
            // Also update assigned_module on polygonal_steps for visual
            const updatedPolySteps = state.polygonal_steps.map((seg, idx) => {
                if (idx >= action.startIdx && idx <= action.endIdx) {
                    return { ...seg, assigned_module: action.moduleId };
                }
                return seg;
            });
            return autoRebuildCarnet({
                ...state,
                custom_assignments: newAssignments,
                polygonal_steps: updatedPolySteps
            });
        }

        case 'SET_CUSTOM_ASSIGNMENTS': {
            pushHistory(state);
            return { ...state, custom_assignments: action.assignments };
        }

        // ── Carnet / Textual mode ──────────────────────────────────────────
        case 'REBUILD_CARNET':
            return autoRebuildCarnet(state);

        case 'TOGGLE_ANNEXE': {
            pushHistory(state);
            const set = new Set(state.enabled_annexes || []);
            if (set.has(action.annexeId)) set.delete(action.annexeId);
            else set.add(action.annexeId);
            return { ...state, enabled_annexes: Array.from(set) };
        }

        case 'SET_CARNET_VIEW':
            return { ...state, carnet_view: action.view };

        case 'TOGGLE_GENERAL_MAP':
            return { ...state, carnet_include_general_map: !state.carnet_include_general_map };

        case 'TOGGLE_ELEVATION_PROFILE':
            return { ...state, carnet_include_elevation_profile: !(state.carnet_include_elevation_profile ?? true) };

        case 'MANUAL_MODULE_ASSIGNMENT': {
            pushHistory(state);
            const stepToChange = state.carnet_steps.find(s => s.id === action.stepId);
            if (!stepToChange) return state;

            if (stepToChange.isManual) {
                const newSteps = state.carnet_steps.map(s => {
                    if (s.id !== action.stepId) return s;
                    return regenerateStepTexts({ ...s, moduleId: action.moduleId as ModuleId }, state);
                });
                return { ...state, carnet_steps: autoMergeSteps(newSteps) };
            } else {
                // Update custom assignments for computed segments
                const newAssignments = { ...state.custom_assignments };
                const polySteps = [...state.polygonal_steps];
                if (stepToChange.segmentIndices) {
                    stepToChange.segmentIndices.forEach(idx => {
                        newAssignments[idx.toString()] = action.moduleId;
                        if (polySteps[idx]) {
                            polySteps[idx] = { ...polySteps[idx], assigned_module: action.moduleId as ModuleId };
                        }
                    });
                }
                const nextState = { ...state, custom_assignments: newAssignments, polygonal_steps: polySteps };
                return autoRebuildCarnet(nextState);
            }
        }

        case 'UPDATE_MANUAL_TEXT': {
            const _theme1 = themeManager.getTheme();
            return {
                ...state,
                carnet_steps: state.carnet_steps.map(s => {
                    if (s.id === action.stepId) {
                        const encoded = ModuleLogic.encode(s.moduleId, action.text, { key: _theme1.vigenere_key });
                        return { ...s, solutionText: action.text, encodedText: encoded };
                    }
                    if (s.inlineManualSteps) {
                        let changed = false;
                        const newInline = { ...s.inlineManualSteps };
                        for (const [k, v] of Object.entries(newInline)) {
                            if (v.id === action.stepId) {
                                const encoded = ModuleLogic.encode(v.moduleId, action.text, { key: _theme1.vigenere_key });
                                newInline[k as any] = { ...v, solutionText: action.text, encodedText: encoded };
                                changed = true;
                            }
                        }
                        if (changed) return { ...s, inlineManualSteps: newInline };
                    }
                    return s;
                })
            };
        }

        case 'INSERT_MANUAL_STEP': {
            pushHistory(state);
            const afterIdx = state.carnet_steps.findIndex(s => s.id === action.afterStepId);

            // Compute anchorSegmentIdx: last poly-segment index of the preceding computed step.
            // This is stored so autoRebuildCarnet can re-insert the comment at the exact same
            // position even when steps merge/split due to module reassignment.
            let anchorSegmentIdx: number = -1;
            if (afterIdx >= 0) {
                for (let i = afterIdx; i >= 0; i--) {
                    const s = state.carnet_steps[i];
                    if (!s.isManual && s.segmentIndices && s.segmentIndices.length > 0) {
                        anchorSegmentIdx = s.segmentIndices[s.segmentIndices.length - 1];
                        break;
                    }
                }
            }

            const manualStep: CarnetStep = {
                id: `manual-${Date.now()}`,
                fromLabel: '',
                toLabel: '',
                moduleId: 'texte_clair',
                distanceM: 0,
                azimuth: 0,
                coords: [],
                solutionText: action.content,
                encodedText: action.content,
                warnings: [],
                isManual: true,
                anchorSegmentIdx,
            };
            const newSteps = [...state.carnet_steps];
            newSteps.splice(afterIdx + 1, 0, manualStep);
            return { ...state, carnet_steps: newSteps };
        }

        case 'REMOVE_MANUAL_STEP':
            pushHistory(state);
            return {
                ...state,
                carnet_steps: state.carnet_steps.filter(s => s.id !== action.stepId).map(s => {
                    if (s.inlineManualSteps) {
                        const newInline = { ...s.inlineManualSteps };
                        let changed = false;
                        for (const key of Object.keys(newInline)) {
                            if (newInline[key as any].id === action.stepId) {
                                delete newInline[key as any];
                                changed = true;
                            }
                        }
                        if (changed) return { ...s, inlineManualSteps: newInline };
                    }
                    return s;
                })
            };


        case 'INSERT_MANUAL_STEP_TYPED': {
            pushHistory(state);
            let anchorSegmentIdxT: number = -1;
            const afterIdxT = state.carnet_steps.findIndex(s => s.id === action.afterStepId);

            if (action.anchorSegmentIdx !== undefined) {
                anchorSegmentIdxT = action.anchorSegmentIdx;
            } else if (afterIdxT >= 0) {
                for (let i = afterIdxT; i >= 0; i--) {
                    const s = state.carnet_steps[i];
                    if (!s.isManual && s.segmentIndices && s.segmentIndices.length > 0) {
                        anchorSegmentIdxT = s.segmentIndices[s.segmentIndices.length - 1];
                        break;
                    }
                }
            }
            const theme_t = themeManager.getTheme(state.theme_id);
            const modId = (action.moduleId || 'texte_clair') as ModuleId;
            const encoded_t = action.manualType === 'code'
                ? ModuleLogic.encode(modId, action.content, { key: theme_t.vigenere_key })
                : action.content;
            const typedStep: CarnetStep = {
                id: `manual-${Date.now()}`,
                fromLabel: '', toLabel: '',
                moduleId: modId,
                distanceM: 0, azimuth: 0, coords: [],
                solutionText: action.content,
                encodedText: encoded_t,
                warnings: [],
                isManual: true,
                manualType: action.manualType,
                anchorSegmentIdx: anchorSegmentIdxT,
            };
            const stepsT = [...state.carnet_steps];
            stepsT.splice(afterIdxT + 1, 0, typedStep);
            return autoRebuildCarnet({ ...state, carnet_steps: stepsT });
        }

        case 'EDIT_COMPUTED_TEXT': {
            const theme_e = themeManager.getTheme(state.theme_id);
            return {
                ...state,
                carnet_steps: state.carnet_steps.map(s => {
                    if (s.id !== action.stepId || s.isManual) return s;
                    let newText = action.newSolutionText;
                    
                    if (action.lineIdx !== undefined) {
                        const lines = (s.solutionText || '').split('\n').filter(Boolean);
                        if (action.lineIdx >= 0 && action.lineIdx < lines.length) {
                            lines[action.lineIdx] = newText;
                            newText = lines.join('\n');
                        }
                    }

                    // ── Validator: check if distance/azimuth match within ±10% ──
                    // If the original used "Azimut" wording and the user changed to directional
                    // (e.g. "tourner à droite"), we auto-detect and switch navLanguage instead.
                    const DIRECTIONAL_KEYWORDS = ['tournez', 'tourner', 'prenez', 'allez', 'gauche', 'droite', 'continuez'];
                    const lowerNew = newText.toLowerCase();
                    const seemsDirectional = DIRECTIONAL_KEYWORDS.some(kw => lowerNew.includes(kw));

                    let newNavLang = s.navLanguage;
                    if (seemsDirectional && (s.navLanguage === 'Azimut' || !s.navLanguage)) {
                        // Auto-switch to "Tournant" language (directional)
                        newNavLang = 'Tournant';
                    }

                    const lines = newText.split('\n');
                    const encodedLines = lines.map(t => ModuleLogic.encode(s.moduleId, t, { key: theme_e.vigenere_key }));
                    const encoded_e = encodedLines.join('\n');

                    return {
                        ...s,
                        solutionText: newText,
                        encodedText: encoded_e,
                        navLanguage: newNavLang,
                        isEdited: true,
                        warnings: [], // suppress constraint warnings on edited steps
                    };
                })
            };
        }

        case 'PERSIST_MAP_STATE': {
            return {
                ...state,
                carnet_steps: state.carnet_steps.map(s => {
                    if (s.id !== action.stepId) return s;
                    return {
                        ...s,
                        mapPersist: {
                            ...s.mapPersist,
                            zoom: action.zoom !== undefined ? action.zoom : (s.mapPersist?.zoom ?? 15),
                            center: action.center !== undefined ? action.center : (s.mapPersist?.center ?? [0, 0]),
                            bounds: action.bounds !== undefined ? action.bounds : s.mapPersist?.bounds,
                            height: action.height !== undefined ? action.height : s.mapPersist?.height,
                            width: action.width !== undefined ? action.width : s.mapPersist?.width,
                            widthPercent: action.widthPercent !== undefined ? action.widthPercent : s.mapPersist?.widthPercent,
                            alignment: action.alignment !== undefined ? action.alignment : s.mapPersist?.alignment,
                            scaleName: action.scaleName !== undefined ? action.scaleName : s.mapPersist?.scaleName,
                            layerId: action.layerId !== undefined ? action.layerId : s.mapPersist?.layerId,
                            isLocked: action.isLocked !== undefined ? action.isLocked : s.mapPersist?.isLocked,
                            showRoute: action.showRoute !== undefined ? action.showRoute : s.mapPersist?.showRoute,
                            showEndpoints: action.showEndpoints !== undefined ? action.showEndpoints : s.mapPersist?.showEndpoints,
                            showAnnotations: action.showAnnotations !== undefined ? action.showAnnotations : s.mapPersist?.showAnnotations,
                        }
                    };
                })
            };
        }

        case 'SET_NAV_LANGUAGE': {
            if (action.segIdx !== undefined) {
                const newLangs = { ...state.custom_languages };
                if (action.lang) newLangs[action.segIdx.toString()] = action.lang;
                else delete newLangs[action.segIdx.toString()];
                return autoRebuildCarnet({ ...state, custom_languages: newLangs });
            }
            if (action.stepId) {
                return {
                    ...state,
                    carnet_steps: state.carnet_steps.map(s => {
                        if (s.id !== action.stepId) return s;
                        return regenerateStepTexts({ ...s, navLanguage: action.lang }, state);
                    })
                };
            }
            return state;
        }

        case 'TOGGLE_POI': {
            if (action.segIdx !== undefined && state.segment_pois) {
                const segPois = state.segment_pois[action.segIdx.toString()] || [];
                const updatedPois = segPois.map(p =>
                    p.id === action.poiId ? { ...p, selected: !p.selected } : p
                );
                // Also update the fallback POI in polygonal_steps
                const selected = updatedPois.find(p => p.selected) || updatedPois[0] || null;
                const newPolySteps = [...state.polygonal_steps];
                if (newPolySteps[action.segIdx]) {
                    newPolySteps[action.segIdx] = {
                        ...newPolySteps[action.segIdx],
                        poi: selected ? { name: selected.name, type: 'landmark', distance_m: 0 } : null
                    };
                }
                const newSegmentPois = { ...state.segment_pois, [action.segIdx.toString()]: updatedPois };
                return autoRebuildCarnet({ ...state, segment_pois: newSegmentPois, polygonal_steps: newPolySteps });
            }
            if (action.stepId) {
                return {
                    ...state,
                    carnet_steps: state.carnet_steps.map(s => {
                        if (s.id !== action.stepId || !s.pois) return s;
                        const updatedPois = s.pois.map(p =>
                            p.id === action.poiId ? { ...p, selected: !p.selected } : p
                        );
                        return regenerateStepTexts({ ...s, pois: updatedPois }, state);
                    })
                };
            }
            return state;
        }

        case 'TOGGLE_POIS_ON_MAP':
            return { ...state, show_pois_on_map: !state.show_pois_on_map };

        case 'TOGGLE_DANGERS_ON_MAP':
            return { ...state, show_dangers_on_map: !state.show_dangers_on_map };

        case 'TOGGLE_STAGES_ON_MAP':
            return { ...state, show_stages_on_map: !state.show_stages_on_map };

        // ── POI persistence ────────────────────────────────────────────────
        case 'SET_SEGMENT_POIS': {
            const newSegmentPois = action.segment_pois as Record<string, import('./logic/types').POIResult[]>;
            return autoRebuildCarnet({ ...state, segment_pois: newSegmentPois });
        }

        // ── Configuration ──────────────────────────────────────────────────
        case 'SET_THEME': {
            pushHistory(state);
            themeManager.setTheme(action.themeId);
            const newState = { ...state, theme_id: action.themeId };
            const themedSteps = newState.carnet_steps.map(step => {
                if (step.isManual) return step;
                return regenerateStepTexts(step, newState);
            });
            return { ...newState, carnet_steps: themedSteps };
        }

        case 'SET_PRESET': {
            pushHistory(state);
            presetsManager.setActivePreset(action.presetId);
            return autoRebuildCarnet({ ...state, active_preset_id: action.presetId });
        }

        case 'SET_SMALL_ROADS':
            return { ...state, small_roads_only: action.enabled };

        case 'SET_IGN_LAYER': {
            const next = { ...state, active_ign_layer: action.layer };
            StateManager.savePreferences(next);
            return next;
        }

        case 'SET_MAP_API_KEYS': {
            const next = { 
                ...state, 
                mapy_api_key: action.mapyKey !== undefined ? action.mapyKey : state.mapy_api_key,
                ign_api_key: action.ignKey !== undefined ? action.ignKey : state.ign_api_key
            };
            StateManager.savePreferences(next);
            return next;
        }

        // ── Persistence (Undo / Redo / Load) ───────────────────────────────
        case 'UNDO': {
            if (historyStack.length === 0) return state;
            redoStack.push({ ...state, notifications: [], is_loading: false, loading_text: '' });
            const prev = historyStack.pop()!;
            return { ...prev, notifications: state.notifications, is_loading: state.is_loading, loading_text: state.loading_text };
        }

        case 'REDO': {
            if (redoStack.length === 0) return state;
            historyStack.push({ ...state, notifications: [], is_loading: false, loading_text: '' });
            const next = redoStack.pop()!;
            return { ...next, notifications: state.notifications, is_loading: state.is_loading, loading_text: state.loading_text };
        }

        case 'SET_DOCUMENT_TITLE':
            return { ...state, document_title: action.title.trim() || 'Document sans titre' };

        case 'SET_CURRENT_FILEPATH':
            return { ...state, current_filepath: action.filepath };

        case 'LOAD_PROJECT':
            historyStack = [];
            redoStack = [];
            return { ...action.state, notifications: [], is_loading: false, loading_text: '' };

        case 'NEW_PROJECT':
            historyStack = [];
            redoStack = [];
            return { ...initialState };

        // ── UI transient ───────────────────────────────────────────────────
        case 'SET_LOADING':
            return { ...state, is_loading: action.isLoading, loading_text: action.text || '' };

        case 'ADD_NOTIFICATION':
            return {
                ...state,
                notifications: [...state.notifications, {
                    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                    message: action.message,
                    type: action.notifType,
                    expiresAt: Date.now() + (action.duration || 5000)
                }].slice(-30)
            };

        case 'REMOVE_NOTIFICATION':
            return {
                ...state,
                notifications: state.notifications.filter(n => n.id !== action.id)
            };

        case 'SET_AUTO_CHECK_UPDATES':
            return { ...state, auto_check_updates: action.enabled };

        default:
            return state;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTO-MERGE: If two adjacent steps have the same module, fuse them
// (from new forge instructions.md §3)
// ─────────────────────────────────────────────────────────────────────────────

function autoMergeSteps(steps: CarnetStep[]): CarnetStep[] {
    if (steps.length <= 1) return steps;

    const isMapModule = (mod: string) => ['carte_ign', 'carte_simple', 'drapeaux'].includes(mod);

    const merged: CarnetStep[] = [steps[0]];
    for (let i = 1; i < steps.length; i++) {
        const prev = merged[merged.length - 1];
        const curr = steps[i];

        const bothMaps = !prev.isManual && !curr.isManual && isMapModule(prev.moduleId) && isMapModule(curr.moduleId);
        const sameNonMapModule = !prev.isManual && !curr.isManual && !isMapModule(prev.moduleId) && prev.moduleId === curr.moduleId;

        if (bothMaps || sameNonMapModule) {
            let combinedCoords = prev.coords || [];
            if (curr.coords && curr.coords.length > 0) {
                if (combinedCoords.length > 0 &&
                    Math.abs(combinedCoords[combinedCoords.length - 1][0] - curr.coords[0][0]) < 0.00001 &&
                    Math.abs(combinedCoords[combinedCoords.length - 1][1] - curr.coords[0][1]) < 0.00001) {
                    combinedCoords = [...combinedCoords, ...curr.coords.slice(1)];
                } else {
                    combinedCoords = [...combinedCoords, ...curr.coords];
                }
            }

            merged[merged.length - 1] = {
                ...prev,
                moduleId: bothMaps ? 'carte_ign' : prev.moduleId,
                toLabel: curr.toLabel || prev.toLabel,
                distanceM: prev.distanceM + curr.distanceM,
                coords: combinedCoords,
                segmentIndices: [...(prev.segmentIndices || []), ...(curr.segmentIndices || [])],
                solutionText: (prev.solutionText && curr.solutionText) ? (prev.solutionText + '\n' + curr.solutionText) : (prev.solutionText || curr.solutionText),
                encodedText: (prev.encodedText && curr.encodedText) ? (prev.encodedText + '\n' + curr.encodedText) : (prev.encodedText || curr.encodedText),
                warnings: [...(prev.warnings || []), ...(curr.warnings || [])],
                mapPersist: prev.mapPersist || curr.mapPersist,
            };
        } else {
            merged.push(curr);
        }
    }
    return merged;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT & PROVIDER
// ─────────────────────────────────────────────────────────────────────────────

function autoRebuildCarnet(state: AppState): AppState {
    const activePresetData = presetsManager.activePreset;
    if (!activePresetData || state.polygonal_steps.length === 0) return state;

    const orchestrator = new Orchestrator(
        state.polygonal_steps,
        activePresetData.weights,
        activePresetData.overrides,
        state.custom_assignments
    );

    const assignments = orchestrator.calculateAssignments();
    const plan = orchestrator.generateExportPlan();

    const updatedPolySteps = state.polygonal_steps.map((seg, idx) => {
        const segPois = state.segment_pois?.[idx.toString()] || [];
        const selected = segPois.find(p => p.selected) || segPois[0] || null;
        return {
            ...seg,
            assigned_module: assignments[idx.toString()] || 'texte_clair',
            poi: selected ? { name: selected.name, type: 'landmark', distance_m: 0 } : seg.poi
        };
    });

    const newComputedSteps = CarnetEngine.generateStepsFromPlan(
        plan,
        updatedPolySteps,
        state.stages,
        activePresetData
    );

    const violations = ConstraintChecker.validate(state.polygonal_steps, assignments, activePresetData);

    newComputedSteps.forEach(step => {
        step.warnings = violations
            .filter(v => assignments[v.seg_idx.toString()] === step.moduleId)
            .map((v, i) => ({
                id: `v-${i}`,
                stepId: step.id,
                severity: v.level,
                rule: 'Constraint',
                message: v.message,
                detail: v.explanation
            }));
    });

    // Preserving old properties
    const oldSteps = state.carnet_steps;
    
    let finalSteps = newComputedSteps.map(newStep => {
        if (!newStep.segmentIndices || newStep.segmentIndices.length === 0) return newStep;
        const firstSegIdx = newStep.segmentIndices[0];
        
        // Pull latest POIs from state for this segment
        if (state.segment_pois && state.segment_pois[firstSegIdx]) {
            newStep.pois = state.segment_pois[firstSegIdx];
        }

        const oldStep = oldSteps.find(s => !s.isManual && s.segmentIndices && s.segmentIndices[0] === firstSegIdx);
        if (oldStep) {
            newStep.navLanguage = oldStep.navLanguage;
            newStep.mapPersist = oldStep.mapPersist;
            
            // If the user manually edited this step, preserve their text and flag
            if (oldStep.isEdited) {
                return {
                    ...newStep,
                    isEdited: true,
                    solutionText: oldStep.solutionText,
                    encodedText: oldStep.encodedText,
                    navLanguage: oldStep.navLanguage,
                    pois: oldStep.pois, // Preserve POI selections too
                };
            }
        }
        
        // ── Cache: skip regeneration if nothing that affects the text has changed ──
        if (oldStep && oldStep.solutionText) {
            const oldSelectedPoi = oldStep.pois?.find((p: any) => p.selected);
            const newSelectedPoi = newStep.pois?.find((p: any) => p.selected);
            
            // Build cache key from all inputs that affect the output text
            const cacheInputs = [
                newStep.moduleId,
                newStep.navLanguage ?? '',
                newSelectedPoi?.id ?? '',
                state.theme_id,
                // All segments' azimut+distance
                ...newStep.segmentIndices.map(i => {
                    const s = state.polygonal_steps[i];
                    return s ? `${Math.round(s.azimut ?? 0)},${Math.round(s.distance ?? 0)}` : '?';
                })
            ].join('|');

            const oldCacheInputs = [
                oldStep.moduleId,
                oldStep.navLanguage ?? '',
                oldSelectedPoi?.id ?? '',
                state.theme_id,
                ...newStep.segmentIndices.map(i => {
                    const s = state.polygonal_steps[i];
                    return s ? `${Math.round(s.azimut ?? 0)},${Math.round(s.distance ?? 0)}` : '?';
                })
            ].join('|');

            if (cacheInputs === oldCacheInputs) {
                return {
                    ...newStep,
                    solutionText: oldStep.solutionText,
                    encodedText: oldStep.encodedText,
                    pois: oldStep.pois, // Preserve POI selections
                };
            }
        }
        
        return regenerateStepTexts(newStep, state);
    });

    // Extract all manual steps (including inline ones)
    const manualSteps = oldSteps.flatMap(s => {
        const arr = [];
        if (s.isManual) arr.push(s);
        if (s.inlineManualSteps) arr.push(...Object.values(s.inlineManualSteps));
        return arr;
    });

    manualSteps.forEach(manualStep => {
        const oldIndex = oldSteps.findIndex(s => s.id === manualStep.id);

        if (manualStep.anchorSegmentIdx !== undefined && manualStep.anchorSegmentIdx >= 0) {
            const newIndex = finalSteps.findIndex(
                s => !s.isManual && s.segmentIndices?.includes(manualStep.anchorSegmentIdx!)
            );
            if (newIndex !== -1) {
                const step = finalSteps[newIndex];
                const segs = step.segmentIndices!;
                if (segs[segs.length - 1] === manualStep.anchorSegmentIdx) {
                    finalSteps.splice(newIndex + 1, 0, manualStep);
                } else {
                    if (!step.inlineManualSteps) step.inlineManualSteps = {};
                    step.inlineManualSteps[manualStep.anchorSegmentIdx] = manualStep;
                }
                return;
            }
        }

        if (oldIndex > 0) {
            let precedingComputedStep = null;
            for (let i = oldIndex - 1; i >= 0; i--) {
                if (!oldSteps[i].isManual) {
                    precedingComputedStep = oldSteps[i];
                    break;
                }
            }
            if (precedingComputedStep && precedingComputedStep.segmentIndices && precedingComputedStep.segmentIndices.length > 0) {
                const lastSegIdx = precedingComputedStep.segmentIndices[precedingComputedStep.segmentIndices.length - 1];
                const newIndex = finalSteps.findIndex(s => !s.isManual && s.segmentIndices?.includes(lastSegIdx));
                if (newIndex !== -1) {
                    finalSteps.splice(newIndex + 1, 0, manualStep);
                } else {
                    finalSteps.push(manualStep);
                }
            } else {
                finalSteps.unshift(manualStep);
            }
        } else {
            finalSteps.unshift(manualStep);
        }
    });

    const usedModules = new Set(finalSteps.map(s => s.moduleId));
    const MODULE_TO_ANNEXE: Record<string, string | undefined> = {
        morse: 'alphabet_morse',
        polybe: 'grille_polybe',
        vigenere: 'tableau_vigenere',
        maritime: 'index_drapeaux',
        templier: 'code_templier',
        avocat: 'methode_avocat',
        gilwell: 'alphabet_gilwell',
    };
    
    let newAnnexes = new Set(state.enabled_annexes || []);
    usedModules.forEach(mod => {
        const annexe = MODULE_TO_ANNEXE[mod];
        if (annexe) newAnnexes.add(annexe as any);
    });

    // Always merge consecutive map steps so they are never split in the editor
    finalSteps = autoMergeSteps(finalSteps);

    return { 
        ...state, 
        carnet_steps: finalSteps, 
        polygonal_steps: updatedPolySteps,
        enabled_annexes: Array.from(newAnnexes)
    };
}

function regenerateStepTexts(step: CarnetStep, state: AppState): CarnetStep {
    if (step.isManual) {
        const _t = themeManager.getTheme(state.theme_id);
        const src = step.solutionText || step.encodedText;
        return {
            ...step,
            solutionText: src,
            encodedText: ModuleLogic.encode(step.moduleId, src, { key: _t.vigenere_key })
        };
    }

    const theme = themeManager.getTheme(state.theme_id);
    const selectedPoi = step.pois?.find(p => p.selected);

    if (!step.segmentIndices || step.segmentIndices.length === 0) return step;

    const segments = step.segmentIndices.map(idx => state.polygonal_steps[idx]).filter(Boolean);

    const navTexts = segments.map((seg, idx) => {
        const globalIdx = step.segmentIndices![idx];
        const prevAzimuth = globalIdx > 0 ? state.polygonal_steps[globalIdx - 1].azimut : undefined;
        // Fetch segment-specific POIs
        const segPois = state.segment_pois?.[globalIdx.toString()];
        const segSelectedPoi = segPois?.find(p => p.selected);
        const poiName = segSelectedPoi ? segSelectedPoi.name : (seg.poi?.name || null);
        const poiType = segSelectedPoi ? 'landmark' : (seg.poi?.type || 'landmark');
        const poiObj = poiName ? { name: poiName, type: poiType } : null;

        // Fetch segment-specific Language
        const segLang = state.custom_languages?.[globalIdx.toString()] || step.navLanguage;

        return NavigationText.generate(seg.distance || 0, seg.azimut || 0, poiObj, theme, prevAzimuth, segLang);
    });
    const navText = navTexts.join('\n');

    const encodedTexts = navTexts.map(text => ModuleLogic.encode(step.moduleId, text, { key: theme.vigenere_key }));
    const encodedText = encodedTexts.join('\n');

    return {
        ...step,
        solutionText: navText,
        encodedText: encodedText
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVE ITINERARY SYNCHRONIZATION
// ─────────────────────────────────────────────────────────────────────────────

function syncActiveItinerary(nextState: AppState): AppState {
    if (!nextState.itineraries || nextState.itineraries.length === 0) {
        const defaultId = 'itin-1';
        return {
            ...nextState,
            itineraries: [{
                id: defaultId,
                name: 'Itinéraire 1 (Principal)',
                color: '#2d8ceb',
                visible: true,
                stages: nextState.stages || [],
                routes: nextState.routes || [],
                polygonal_steps: nextState.polygonal_steps || [],
                polygonal_legs: nextState.polygonal_legs || {},
                carnet_steps: nextState.carnet_steps || [],
                custom_assignments: nextState.custom_assignments || {},
                custom_languages: nextState.custom_languages || {},
            }],
            active_itinerary_id: defaultId
        };
    }

    const activeId = nextState.active_itinerary_id || nextState.itineraries[0].id;
    const updatedItineraries = nextState.itineraries.map(it => {
        if (it.id === activeId) {
            return {
                ...it,
                stages: nextState.stages || [],
                routes: nextState.routes || [],
                polygonal_steps: nextState.polygonal_steps || [],
                polygonal_legs: nextState.polygonal_legs || {},
                carnet_steps: nextState.carnet_steps || [],
                custom_assignments: nextState.custom_assignments || {},
                custom_languages: nextState.custom_languages || {},
            };
        }
        return it;
    });

    return {
        ...nextState,
        itineraries: updatedItineraries,
        active_itinerary_id: activeId
    };
}

export const AppContext = createContext<{
    state: AppState;
    dispatch: React.Dispatch<AppAction>;
}>({ state: initialState, dispatch: () => null });

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer((s: AppState, a: AppAction) => syncActiveItinerary(appReducer(s, a)), initialState);
    const prevRoutesRef = useRef(state.routes);

    // ── Initialize async stores ────────────────────────────────────────
    useEffect(() => {
        Promise.all([
            presetsManager.load(),
            themeManager.load()
        ]).then(() => {
            console.log("Presets and Themes loaded");
        });
    }, []);

    // ── BackgroundEngine listener (global — not tied to any panel) ──────
    // Per-leg pipeline: ① BRouter → ② Azimut → ③ POI → ④ Carnet
    // ⑤ Danger check runs inside ① using BRouter WayTags.
    useEffect(() => {
        backgroundEngine.setListeners(
            (jobId, type, result) => {
                if (type === 'route_leg') {
                    const legKey = result.legKey ?? jobId;

                    // ── Area edge routing (zone BRouter per-edge) ──────────
                    // legKey format: "area-edge-{areaId}-{edgeIdx}"
                    if (legKey.startsWith('area-edge-')) {
                        const pendingRoutes = backgroundEngine.pendingCount('route_leg');
                        dispatch({ type: 'SET_LOADING', isLoading: pendingRoutes > 0, text: pendingRoutes > 0 ? `BRouter — ${pendingRoutes} arête(s) restantes...` : '' });

                        const parts = legKey.split('-'); // ["area","edge",areaId,edgeIdx]
                        const edgeIdx = parseInt(parts[parts.length - 1], 10);
                        const areaId = parts.slice(2, parts.length - 1).join('-');

                        // Build edgePts [lat,lon] from BRouter result (coordinates are [lon,lat])
                        const edgePts: [number, number][] = result.coordinates
                            ? result.coordinates.map((c: any) => [c[1], c[0]] as [number, number])
                            : null;

                        // Fetch current area to merge edgeRoutes
                        const currentArea = stateRef.current.area_annotations?.find((a: any) => a.id === areaId);
                        if (currentArea && edgePts && !isNaN(edgeIdx)) {
                            const newEdgeRoutes = [...(currentArea.edgeRoutes || Array(currentArea.coords.length).fill(null))];
                            newEdgeRoutes[edgeIdx] = edgePts;
                            // Recompute area from full display polygon
                            const displayPoly = buildAreaDisplayCoords(currentArea.coords, newEdgeRoutes);
                            const m2 = displayPoly.length >= 3 ? calculatePolygonArea(displayPoly) : 0;
                            dispatch({
                                type: 'UPDATE_AREA_ANNOTATION',
                                id: areaId,
                                patch: { edgeRoutes: newEdgeRoutes, area_m2: m2, formatted_area: formatArea(m2) }
                            });
                        }
                        return;
                    }

                    // ── Normal route_leg pipeline ─────────────────────────

                    const pendingRoutes = backgroundEngine.pendingCount('route_leg');
                    dispatch({ type: 'SET_LOADING', isLoading: pendingRoutes > 0, text: pendingRoutes > 0 ? `BRouter — ${pendingRoutes} tronçon(s) restants...` : '' });

                    const props = result.alts?.[0]?.geometry?.properties || {};

                    // — Recompute insertIdx from p1/p2 coordinates at dispatch time —
                    let safeInsertIdx = result.insertIdx;
                    let isValid = true;
                    if (result.p1 && result.p2) {
                        const currentStages = stateRef.current.stages;
                        const COORD_TOL = 0.0002; // ~20m tolerance
                        let bestIdx = -1;
                        for (let i = 0; i < currentStages.length - 1; i++) {
                            const s1 = currentStages[i].coords;
                            const s2 = currentStages[i + 1].coords;
                            const p1MatchesS1 = Math.abs(s1[0] - result.p1[0]) < COORD_TOL && Math.abs(s1[1] - result.p1[1]) < COORD_TOL;
                            const p2MatchesS2 = Math.abs(s2[0] - result.p2[0]) < COORD_TOL && Math.abs(s2[1] - result.p2[1]) < COORD_TOL;
                            if (p1MatchesS1 && p2MatchesS2) { bestIdx = i; break; }
                        }
                        if (bestIdx !== -1) {
                            safeInsertIdx = bestIdx;
                            console.log(`[Pipeline ①] Remapped insertIdx ${result.insertIdx} → ${bestIdx} from stage coords`);
                        } else {
                            console.warn(`[Pipeline ①] Dropping obsolete route (stages have changed/deleted since request)`);
                            isValid = false;
                        }
                    }

                    if (!isValid) {
                        dispatch({ type: 'SET_LOADING', isLoading: pendingRoutes > 0 });
                        return;
                    }

                    dispatch({
                        type: 'ADD_ROUTE',
                        insertIdx: safeInsertIdx,
                        route: {
                            id: jobId,
                            distance_m: result.distance || 0,
                            geojson: {
                                type: 'Feature',
                                properties: props,
                                geometry: { type: 'LineString', coordinates: result.coordinates }
                            },
                            alternatives: result.alts || [],
                            profile: result.profile
                        }
                    });


                    // ── ⑤ Danger check (BRouter WayTags parsed by IGNClient) ──────
                    if (props.danger_level === 'extreme') {
                        dispatch({ type: 'ADD_NOTIFICATION', message: 'Tronçon sur autoroute (>200m) — trajet très dangereux !', notifType: 'error', duration: 8000 });
                    } else if (props.danger_level === 'motorway_cross') {
                        dispatch({ type: 'ADD_NOTIFICATION', message: 'Le trajet traverse une autoroute — vérifiez le tracé.', notifType: 'error', duration: 8000 });
                    } else if (props.danger_level === 'high') {
                        dispatch({ type: 'ADD_NOTIFICATION', message: 'Tronçon sur nationale / départementale (>200m)', notifType: 'warning', duration: 7000 });
                    } else if (props.is_fallback) {
                        dispatch({ type: 'ADD_NOTIFICATION', message: 'Fallback OSRM utilisé — vérifiez le tracé.', notifType: 'warning', duration: 7000 });
                    } else if (props.danger_level === 'minor') {
                        dispatch({ type: 'ADD_NOTIFICATION', message: 'Petit tronçon sur route secondaire détecté.', notifType: 'info' });
                    }

                } else if (type === 'azimut_leg') {
                    const legKey = result.legKey ?? jobId;
                    latestAziKeyRef.current = legKey;
                    const segs: import('./logic/types').PolySegment[] = result.segments ?? result;
                    console.log(`[Pipeline ②] Azimut done  legKey=${legKey}  →  ${segs?.length ?? 0} segments`);
                    console.timeEnd(`[Pipeline] ② Azimuts (pending after this)`);
                    dispatch({ type: 'SET_POLYGONAL_STEPS', steps: segs });

                    if (segs && segs.length > 0) {
                        dispatch({ type: 'SET_LOADING', isLoading: true, text: 'Recherche de points d\'intérêt...' });
                        // ③ POI — Clear any stale pending searches first
                        backgroundEngine.clearByType('poi_search');
                        backgroundEngine.clearByType('carnet_update');
                        backgroundEngine.enqueue('poi_search', 2, `job-poi-${legKey}`, {
                            segments: segs,
                            oldSegments: stateRef.current.polygonal_steps,
                            oldPois: stateRef.current.segment_pois,
                            radiusM: 250,
                            legKey,
                        }, 'poi-global'); // Stable dedup key
                    } else {
                        // No azimut segments → jump straight to carnet
                        dispatch({ type: 'SET_LOADING', isLoading: true, text: 'Mise à jour du carnet...' });
                        backgroundEngine.enqueue('carnet_update', 3, `job-carnet-${legKey}`, { legKey }, `carnet-${legKey}`);
                    }

                } else if (type === 'poi_search') {
                    const legKey = result.legKey ?? jobId;
                    if (legKey !== latestAziKeyRef.current) {
                        console.log(`[Pipeline ③] Skipping stale POI result legKey=${legKey} (current=${latestAziKeyRef.current})`);
                        return;
                    }
                    const nPois = result?.segmentPois ? Object.keys(result.segmentPois).length : 0;
                    console.log(`[Pipeline ③] POI done  legKey=${legKey}  →  ${nPois} segment(s) enriched`);

                    if (result?.segmentPois) {
                        dispatch({ type: 'SET_SEGMENT_POIS', segment_pois: result.segmentPois });
                        // SET_SEGMENT_POIS already rebuilds the carnet texts with POIs.
                        // No need to also enqueue REBUILD_CARNET — it would overwrite with a stale state.
                        const stillPending = backgroundEngine.pendingCount();
                        dispatch({ type: 'SET_LOADING', isLoading: stillPending > 0 });
                    } else {
                        // No POIs found — still trigger a carnet refresh
                        dispatch({ type: 'SET_LOADING', isLoading: true, text: 'Mise à jour du carnet...' });
                        backgroundEngine.enqueue('carnet_update', 3, `job-carnet-${legKey}`, { legKey }, `carnet-${legKey}`);
                    }

                } else if (type === 'carnet_update') {
                    const legKey = result.legKey ?? jobId;
                    console.log(`[Pipeline ④] Carnet update  legKey=${legKey}`);
                    dispatch({ type: 'REBUILD_CARNET' });
                    const stillPending = backgroundEngine.pendingCount();
                    dispatch({ type: 'SET_LOADING', isLoading: stillPending > 0 });

                } else {
                    dispatch({ type: 'SET_LOADING', isLoading: false });
                }
            },
            (jobId, type, error) => {
                dispatch({ type: 'SET_LOADING', isLoading: false });
                console.error('[Pipeline] Job failed:', jobId, type, error);
                dispatch({ type: 'ADD_NOTIFICATION', message: 'Erreur calcul : ' + error, notifType: 'error' });
            }
        );
    }, [dispatch]);

    // ── Trigger polygonalisation when routes change — DEBOUNCED ──────────────
    //
    // Problem we solve: the user clicks fast → many route_legs arrive within
    // milliseconds. Without debouncing, each ADD_ROUTE fires a new azimut_leg
    // immediately, so the queue gets flooded with redundant azimut jobs that
    // all run sequentially after the last route_leg anyway.
    //
    // Solution: wait 300 ms after the last route change before scheduling
    // the azimut job. If another route change arrives before the timer fires,
    // we cancel the previous timer. The azimut job uses dedupKey='azimut-global'
    // so any still-queued (not running) azimut job is replaced automatically.
    const azimutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (azimutTimer.current) clearTimeout(azimutTimer.current);

        if (state.routes.length === 0) {
            if (prevRoutesRef.current.length > 0) {
                dispatch({ type: 'SET_POLYGONAL_STEPS', steps: [] });
            }
            prevRoutesRef.current = state.routes;
            return;
        }

        prevRoutesRef.current = state.routes;

        azimutTimer.current = setTimeout(() => {
            // Do not compute azimut/POI if some routes are still loading (null)
            // This waits for all rapid BRouter/Direct conversions to finish first!
            if (state.routes.some(r => !r)) {
                console.log('[Pipeline] ⏳ Waiting for all route segments to finish loading...');
                return;
            }

            const allCoords = state.routes.flatMap((r: any) =>
                r?.geojson?.geometry?.coordinates || r?.geojson?.coordinates || []
            );
            if (allCoords.length < 2) return;

            // Flush any stale pending azimut / poi / carnet jobs
            backgroundEngine.clearByType('azimut_leg');
            backgroundEngine.clearByType('poi_search');

            dispatch({ type: 'SET_LOADING', isLoading: true, text: 'Calcul des azimuts...' });
            console.time(`[Pipeline] ② Azimuts (pending after this)`);
            backgroundEngine.enqueue(
                'azimut_leg',
                1,
                `job-azimut-${Date.now()}`,
                {
                    geojson: {
                        type: 'FeatureCollection',
                        features: [{
                            type: 'Feature',
                            geometry: { type: 'LineString', coordinates: allCoords }
                        }]
                    },
                    forceIntersections: false,
                    settings: state.polygonalization_settings
                },
                'azimut-global'   // ← dedup key: collapses all pending azimut jobs into one
            );
        }, 300);  // debounce window

        return () => {
            if (azimutTimer.current) clearTimeout(azimutTimer.current);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.routes, state.polygonalization_settings]);

    // ── Mode switch: only force-rebuild if carnet is completely empty ─────────
    const prevMode = useRef(state.active_mode);
    useEffect(() => {
        const justEnteredTextual = state.active_mode === 'textual' && prevMode.current !== 'textual';
        prevMode.current = state.active_mode;

        if (justEnteredTextual && state.polygonal_steps.length > 0 && state.carnet_steps.length === 0) {
            // Carnet has never been built (e.g. project loaded without saving carnet state)
            console.log('[Pipeline] Mode switch: carnet empty, pipeline idle → force rebuild');
            dispatch({ type: 'REBUILD_CARNET' });
        }
    }, [state.active_mode]);

    // ── Keyboard shortcuts ─────────────────────────────────────────────
    const stateRef = useRef(state);
    const latestAziKeyRef = useRef<string | null>(null);
    stateRef.current = state;

    useEffect(() => {
        const handleKeyDown = async (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                dispatch({ type: 'UNDO' });
            }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault();
                dispatch({ type: 'REDO' });
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                dispatch({ type: 'SET_LOADING', isLoading: true, text: 'Enregistrement...' });
                const ok = await StateManager.saveProject(stateRef.current);
                dispatch({ type: 'SET_LOADING', isLoading: false });
                dispatch({ 
                    type: 'ADD_NOTIFICATION', 
                    message: ok ? 'Projet enregistré.' : 'Échec de l\'enregistrement.', 
                    notifType: ok ? 'info' : 'error',
                    duration: 3000
                });
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // ── Debounced Auto-Save to LocalStorage ────────────────────────────
    const saveTimeout = useRef<NodeJS.Timeout | null>(null);
    useEffect(() => {
        // Skip if currently computing or empty
        if (state.is_loading || state.routes.length === 0) return;

        if (saveTimeout.current) {
            clearTimeout(saveTimeout.current);
        }

        saveTimeout.current = setTimeout(() => {
            try {
                const serialized = StateManager.serializeForSave(state);
                localStorage.setItem('scoutraider_autosave', serialized);
            } catch (e) {
                console.warn('LocalStorage autosave failed (quota exceeded?):', e);
            }
        }, 2000);

        return () => {
            if (saveTimeout.current) clearTimeout(saveTimeout.current);
        };
    }, [state]);

    // ── Save Preferences to LocalStorage ───────────────────────────────
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const prefs = {
                show_pois_on_map: state.show_pois_on_map,
                show_dangers_on_map: state.show_dangers_on_map,
                show_stages_on_map: state.show_stages_on_map,
                mapy_api_key: state.mapy_api_key,
                ign_api_key: state.ign_api_key,
            };
            try {
                localStorage.setItem('scoutraider_prefs', JSON.stringify(prefs));
            } catch (e) {
                console.warn('Failed to save preferences to localStorage', e);
            }
        }
    }, [
        state.active_ign_layer,
        state.show_pois_on_map,
        state.show_dangers_on_map,
        state.show_stages_on_map
    ]);

    // ── Listen for Electron menu actions ───────────────────────────────
    useEffect(() => {
        if (typeof window !== 'undefined' && (window as any).electronAPI?.onMenuAction) {
            const cleanup = (window as any).electronAPI.onMenuAction(async (action: string) => {
                switch (action) {
                    case 'undo': dispatch({ type: 'UNDO' }); break;
                    case 'redo': dispatch({ type: 'REDO' }); break;
                    case 'new': dispatch({ type: 'NEW_PROJECT' }); break;

                    case 'open': {
                        const loaded = await StateManager.loadProject();
                        if (loaded) {
                            dispatch({ type: 'LOAD_PROJECT', state: loaded });
                            dispatch({ type: 'ADD_NOTIFICATION', message: 'Projet chargé avec succès.', notifType: 'info' });
                        }
                        break;
                    }

                    case 'save': {
                        dispatch({ type: 'SET_LOADING', isLoading: true, text: 'Enregistrement...' });
                        // Use stateRef to get the absolute latest state for saving
                        const ok = await StateManager.saveProject(stateRef.current);
                        dispatch({ type: 'SET_LOADING', isLoading: false });
                        if (ok) {
                            dispatch({ type: 'ADD_NOTIFICATION', message: 'Projet enregistré.', notifType: 'info', duration: 3000 });
                        } else {
                            dispatch({ type: 'ADD_NOTIFICATION', message: 'Échec de l\'enregistrement.', notifType: 'error' });
                        }
                        break;
                    }
                }
            });
            return cleanup;
        }
    }, []); // Only run once, stateRef handles the updates

    useEffect(() => {
        if (typeof window !== 'undefined' && (window as any).electronAPI?.onOpenProjectAtPath) {
            const cleanup = (window as any).electronAPI.onOpenProjectAtPath(async (path: string) => {
                try {
                    const data = await (window as any).electronAPI.readFile(path);
                    const loaded = StateManager.deserializeFromLoad(data);
                    if (loaded) {
                        dispatch({ type: 'LOAD_PROJECT', state: loaded });
                        dispatch({ type: 'ADD_NOTIFICATION', message: 'Projet chargé par association de fichier.', notifType: 'info' });
                    }
                } catch (e) {
                    console.error('Failed to open file via association:', e);
                    dispatch({ type: 'ADD_NOTIFICATION', message: 'Échec de l\'ouverture du fichier.', notifType: 'error' });
                }
            });
            return cleanup;
        }
    }, [dispatch]);

    return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
};

export function useApp() {
    return useContext(AppContext);
}
