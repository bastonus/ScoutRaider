import React, { createContext, useContext, useReducer, useEffect, useRef, useMemo } from 'react';
import type {
    AppState, RouteDict, PolySegment, CarnetStep,
    ModuleId, AnnexeId, CarnetView, Stage, PolygonalisationSettings,
    Itinerary, PointAnnotation, AreaAnnotation, DrawAnnotation, DrawStroke,
    TextAnnotation, TextItem
} from './logic/types';
import { StateManager } from './logic/StateManager';
import { presetsManager } from './logic/PresetsManager';
import { themeManager } from './logic/ThemeManager';
import { backgroundEngine } from './logic/BackgroundEngine';
import { calculatePolygonArea, formatArea } from './logic/GeoUtils';
import { rootReducer } from './logic/reducers/rootReducer';
import { buildAreaDisplayCoords } from './logic/layerCleanup';

// Specialized Contexts
import { RoutesContext, type RoutesContextValue, useRoutes } from './context/RoutesContext';
import { AnnotationsContext, type AnnotationsContextValue, useAnnotations } from './context/AnnotationsContext';
import { CarnetContext, type CarnetContextValue, useCarnet } from './context/CarnetContext';
import { UIContext, type UIContextValue, useUI } from './context/UIContext';

// Re-export helpers and domain hooks for modular consumption
export { buildAreaDisplayCoords };
export { useRoutes, useAnnotations, useCarnet, useUI };

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
    | { type: 'INSERT_MANUAL_STEP_TYPED'; afterStepId: string; content: string; manualType: 'html' | 'code'; moduleId?: string; anchorSegmentIdx?: number }
    | { type: 'CONVERT_MANUAL_STEP_TYPE'; stepId: string; targetType: 'html' | 'code'; moduleId?: ModuleId }
    | { type: 'LOCK_DOCUMENT_TITLE' }
    | { type: 'REMOVE_MANUAL_STEP'; stepId: string }
    | { type: 'SET_NAV_LANGUAGE'; stepId?: string; segIdx?: number; lang: CarnetStep['navLanguage'] }
    | { type: 'TOGGLE_POI'; stepId?: string; segIdx?: number; poiId: string }
    | { type: 'TOGGLE_POIS_ON_MAP' }
    | { type: 'TOGGLE_DANGERS_ON_MAP' }
    | { type: 'TOGGLE_STAGES_ON_MAP' }
    | { type: 'TOGGLE_AZIMUTH_ARROWS' }
    | { type: 'EDIT_COMPUTED_TEXT'; stepId: string; lineIdx?: number; newSolutionText: string }
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

    // ☁️ Cloud Sync
    | { type: 'SET_CLOUD_SYNC_STATUS'; status: 'synced' | 'pending' | 'offline' | 'error'; lastSynced?: number }
    | { type: 'SET_CLOUD_PROJECT_ID'; projectId: string | null }
    | { type: 'SET_CLOUD_SHARE_TOKEN'; token: string | null }
    | { type: 'TRIGGER_AUTOSAVE' }
    | { type: 'SET_AUTOSAVE_ENABLED'; enabled: boolean }

    // UI transient
    | { type: 'SET_LOADING'; isLoading: boolean; text?: string }
    | { type: 'ADD_NOTIFICATION'; message: string; notifType: 'info' | 'warning' | 'error'; duration?: number }
    | { type: 'REMOVE_NOTIFICATION'; id: string };

// ─────────────────────────────────────────────────────────────────────────────
// INITIAL STATE FACTORY
// ─────────────────────────────────────────────────────────────────────────────

export function getInitialAppState(): AppState {
    return {
        ...StateManager.getInitialState(),
        is_loading: false,
        loading_text: '',
        notifications: [],
        selected_layer_id: 'itin-1',
        selected_sublayer_id: null,
        cloud_sync_status: 'offline' as const,
        cloud_last_synced: null,
        cloud_project_id: null,
        cloud_share_token: null,
        autosave_enabled: true,
    };
}

const initialState = getInitialAppState();

// ─────────────────────────────────────────────────────────────────────────────
// LEGACY COMPOSITE CONTEXT
// ─────────────────────────────────────────────────────────────────────────────

export const AppContext = createContext<{
    state: AppState;
    dispatch: React.Dispatch<AppAction>;
}>({ state: initialState, dispatch: () => null });

// ─────────────────────────────────────────────────────────────────────────────
// APP PROVIDER
// ─────────────────────────────────────────────────────────────────────────────

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(
        (s: AppState, a: AppAction) => rootReducer(s, a, getInitialAppState),
        initialState
    );
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

    // ── Resume interrupted pipeline after LOAD_PROJECT ─────────────────
    const prevIsLoadingRef = useRef(state.is_loading);
    useEffect(() => {
        const wasLoading = prevIsLoadingRef.current;
        prevIsLoadingRef.current = state.is_loading;

        if (wasLoading && !state.is_loading) {
            const hasRoutes = state.routes && state.routes.some((r: any) => r && r.geojson);
            const missingAzimuts = !state.polygonal_steps || state.polygonal_steps.length === 0;
            if (hasRoutes && missingAzimuts) {
                console.log('[Pipeline] 🔄 Reprise du calcul interrompu: routes présentes, azimuts absents');
                setTimeout(() => {
                    const allCoords = state.routes.flatMap((r: any) =>
                        r?.geojson?.geometry?.coordinates || r?.geojson?.coordinates || []
                    );
                    if (allCoords.length >= 2) {
                        dispatch({ type: 'SET_LOADING', isLoading: true, text: 'Reprise du calcul interrompu...' });
                        backgroundEngine.enqueue(
                            'azimut_leg',
                            1,
                            `job-azimut-resume-${Date.now()}`,
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
                            'azimut-global'
                        );
                    }
                }, 500);
            }
        }
    }, [state.is_loading, state.routes, state.polygonal_steps]);

    // ── BackgroundEngine listener (global) ──────────────────────────────
    const stateRef = useRef(state);
    const latestAziKeyRef = useRef<string | null>(null);
    stateRef.current = state;

    useEffect(() => {
        backgroundEngine.setListeners(
            (jobId, type, result) => {
                if (type === 'route_leg') {
                    const legKey = result.legKey ?? jobId;

                    if (legKey.startsWith('area-edge-')) {
                        const pendingRoutes = backgroundEngine.pendingCount('route_leg');
                        dispatch({ type: 'SET_LOADING', isLoading: pendingRoutes > 0, text: pendingRoutes > 0 ? `BRouter — ${pendingRoutes} arête(s) restantes...` : '' });

                        const parts = legKey.split('-');
                        const edgeIdx = parseInt(parts[parts.length - 1], 10);
                        const areaId = parts.slice(2, parts.length - 1).join('-');

                        const edgePts: [number, number][] = result.coordinates
                            ? result.coordinates.map((c: any) => [c[1], c[0]] as [number, number])
                            : null;

                        const currentArea = stateRef.current.area_annotations?.find((a: any) => a.id === areaId);
                        if (currentArea && edgePts && !isNaN(edgeIdx)) {
                            const newEdgeRoutes = [...(currentArea.edgeRoutes || Array(currentArea.coords.length).fill(null))];
                            newEdgeRoutes[edgeIdx] = edgePts;
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

                    const pendingRoutes = backgroundEngine.pendingCount('route_leg');
                    dispatch({ type: 'SET_LOADING', isLoading: pendingRoutes > 0, text: pendingRoutes > 0 ? `BRouter — ${pendingRoutes} tronçon(s) restants...` : '' });

                    const props = result.alts?.[0]?.geometry?.properties || {};

                    let safeInsertIdx = result.insertIdx;
                    let isValid = true;
                    if (result.p1 && result.p2) {
                        const currentStages = stateRef.current.stages;
                        const COORD_TOL = 0.0002;
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
                    dispatch({ type: 'SET_POLYGONAL_STEPS', steps: segs });

                    if (segs && segs.length > 0) {
                        dispatch({ type: 'SET_LOADING', isLoading: true, text: 'Recherche de points d\'intérêt...' });
                        backgroundEngine.clearByType('poi_search');
                        backgroundEngine.clearByType('carnet_update');
                        backgroundEngine.enqueue('poi_search', 2, `job-poi-${legKey}`, {
                            segments: segs,
                            oldSegments: stateRef.current.polygonal_steps,
                            oldPois: stateRef.current.segment_pois,
                            radiusM: 250,
                            legKey,
                        }, 'poi-global');
                    } else {
                        dispatch({ type: 'SET_LOADING', isLoading: true, text: 'Mise à jour du carnet...' });
                        backgroundEngine.enqueue('carnet_update', 3, `job-carnet-${legKey}`, { legKey }, `carnet-${legKey}`);
                    }

                } else if (type === 'poi_search') {
                    const legKey = result.legKey ?? jobId;
                    if (legKey !== latestAziKeyRef.current) {
                        return;
                    }

                    if (result?.segmentPois) {
                        dispatch({ type: 'SET_SEGMENT_POIS', segment_pois: result.segmentPois });
                        const stillPending = backgroundEngine.pendingCount();
                        dispatch({ type: 'SET_LOADING', isLoading: stillPending > 0 });
                    } else {
                        dispatch({ type: 'SET_LOADING', isLoading: true, text: 'Mise à jour du carnet...' });
                        backgroundEngine.enqueue('carnet_update', 3, `job-carnet-${legKey}`, { legKey }, `carnet-${legKey}`);
                    }

                } else if (type === 'carnet_update') {
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
                const msgs: Record<string, string> = {
                    route_leg: '🗺️ Calcul d\'itinéraire échoué (BRouter) — le serveur est peut-être indisponible.',
                    azimut_leg: '📐 Calcul des azimuts échoué — les données de route sont peut-être invalides.',
                    poi_search: '📍 Recherche de points d\'intérêt échouée (Overpass) — continuez normalement.',
                    carnet_update: '📒 Mise à jour du carnet échouée.',
                };
                const msg = msgs[type] || `Erreur calcul : ${error}`;
                dispatch({ type: 'ADD_NOTIFICATION', message: msg, notifType: type === 'poi_search' ? 'warning' : 'error', duration: 6000 });
            }
        );
    }, [dispatch]);

    // ── Trigger polygonalisation when routes change — DEBOUNCED ──────────────
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
            if (state.routes.some(r => !r)) {
                return;
            }

            const allCoords = state.routes.flatMap((r: any) =>
                r?.geojson?.geometry?.coordinates || r?.geojson?.coordinates || []
            );
            if (allCoords.length < 2) return;

            backgroundEngine.clearByType('azimut_leg');
            backgroundEngine.clearByType('poi_search');

            dispatch({ type: 'SET_LOADING', isLoading: true, text: 'Calcul des azimuts...' });
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
                'azimut-global'
            );
        }, 300);

        return () => {
            if (azimutTimer.current) clearTimeout(azimutTimer.current);
        };
    }, [state.routes, state.polygonalization_settings]);

    // ── Mode switch: force rebuild if carnet is empty ────────────────────────
    const prevMode = useRef(state.active_mode);
    useEffect(() => {
        const justEnteredTextual = state.active_mode === 'textual' && prevMode.current !== 'textual';
        prevMode.current = state.active_mode;

        if (justEnteredTextual && state.polygonal_steps.length > 0 && state.carnet_steps.length === 0) {
            dispatch({ type: 'REBUILD_CARNET' });
        }
    }, [state.active_mode, state.polygonal_steps.length, state.carnet_steps.length]);

    // ── Keyboard shortcuts ─────────────────────────────────────────────
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
    const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
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
        state.show_stages_on_map,
        state.mapy_api_key,
        state.ign_api_key
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
    }, []);

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

    // ── Slice Context Values (Memoized for optimal re-renders) ───────────
    const activeItinerary = useMemo(() => {
        return (state.itineraries || []).find(it => it.id === state.active_itinerary_id) || state.itineraries?.[0];
    }, [state.itineraries, state.active_itinerary_id]);

    const routesValue: RoutesContextValue = useMemo(() => ({
        routes: state.routes,
        activeRouteId: state.active_route_id,
        itineraries: state.itineraries,
        activeItineraryId: state.active_itinerary_id,
        activeItinerary,
        stages: state.stages,
        anchorStageIdx: state.anchor_stage_idx,
        polygonalSteps: state.polygonal_steps,
        polygonalLegs: state.polygonal_legs,
        polygonalSettings: state.polygonalization_settings,
        dispatch,
    }), [
        state.routes,
        state.active_route_id,
        state.itineraries,
        state.active_itinerary_id,
        activeItinerary,
        state.stages,
        state.anchor_stage_idx,
        state.polygonal_steps,
        state.polygonal_legs,
        state.polygonalization_settings,
        dispatch,
    ]);

    const annotationsValue: AnnotationsContextValue = useMemo(() => ({
        annotationLayers: state.annotation_layers,
        pointAnnotations: state.point_annotations,
        areaAnnotations: state.area_annotations,
        drawAnnotations: state.draw_annotations,
        textAnnotations: state.text_annotations,
        layerOrder: state.layer_order,
        selectedLayerId: state.selected_layer_id,
        selectedSublayerId: state.selected_sublayer_id,
        dispatch,
    }), [
        state.annotation_layers,
        state.point_annotations,
        state.area_annotations,
        state.draw_annotations,
        state.text_annotations,
        state.layer_order,
        state.selected_layer_id,
        state.selected_sublayer_id,
        dispatch,
    ]);

    const carnetValue: CarnetContextValue = useMemo(() => ({
        carnetSteps: state.carnet_steps,
        carnetView: state.carnet_view,
        carnetIncludeGeneralMap: state.carnet_include_general_map,
        carnetIncludeElevationProfile: state.carnet_include_elevation_profile,
        enabledAnnexes: state.enabled_annexes,
        disabledAnnexes: state.disabled_annexes,
        customAssignments: state.custom_assignments,
        customLanguages: state.custom_languages,
        segmentPois: state.segment_pois,
        dispatch,
    }), [
        state.carnet_steps,
        state.carnet_view,
        state.carnet_include_general_map,
        state.carnet_include_elevation_profile,
        state.enabled_annexes,
        state.disabled_annexes,
        state.custom_assignments,
        state.custom_languages,
        state.segment_pois,
        dispatch,
    ]);

    const uiValue: UIContextValue = useMemo(() => ({
        activeMode: state.active_mode,
        activeTool: state.active_tool,
        documentTitle: state.document_title,
        currentFilepath: state.current_filepath,
        themeId: state.theme_id,
        activePresetId: state.active_preset_id,
        activeIgnLayer: state.active_ign_layer,
        mapyApiKey: state.mapy_api_key,
        ignApiKey: state.ign_api_key,
        smallRoadsOnly: state.small_roads_only,
        showPoisOnMap: state.show_pois_on_map,
        showDangersOnMap: state.show_dangers_on_map,
        showStagesOnMap: state.show_stages_on_map,
        showAzimuthArrows: state.show_azimuth_arrows,
        isLoading: state.is_loading,
        loadingText: state.loading_text,
        notifications: state.notifications,
        cloudSyncStatus: state.cloud_sync_status,
        cloudLastSynced: state.cloud_last_synced,
        cloudProjectId: state.cloud_project_id,
        cloudShareToken: state.cloud_share_token,
        autosaveEnabled: state.autosave_enabled,
        dispatch,
    }), [
        state.active_mode,
        state.active_tool,
        state.document_title,
        state.current_filepath,
        state.theme_id,
        state.active_preset_id,
        state.active_ign_layer,
        state.mapy_api_key,
        state.ign_api_key,
        state.small_roads_only,
        state.show_pois_on_map,
        state.show_dangers_on_map,
        state.show_stages_on_map,
        state.show_azimuth_arrows,
        state.is_loading,
        state.loading_text,
        state.notifications,
        state.cloud_sync_status,
        state.cloud_last_synced,
        state.cloud_project_id,
        state.cloud_share_token,
        state.autosave_enabled,
        dispatch,
    ]);

    const compositeValue = useMemo(() => ({ state, dispatch }), [state, dispatch]);

    return (
        <AppContext.Provider value={compositeValue}>
            <RoutesContext.Provider value={routesValue}>
                <AnnotationsContext.Provider value={annotationsValue}>
                    <CarnetContext.Provider value={carnetValue}>
                        <UIContext.Provider value={uiValue}>
                            {children}
                        </UIContext.Provider>
                    </CarnetContext.Provider>
                </AnnotationsContext.Provider>
            </RoutesContext.Provider>
        </AppContext.Provider>
    );
};

export function useApp() {
    return useContext(AppContext);
}
