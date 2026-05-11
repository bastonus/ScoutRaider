import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import type {
    AppState, RouteDict, PolySegment, PresetData, CarnetStep,
    ModuleId, AnnexeId, CarnetView, Stage, PolygonalisationSettings, Notification
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
    | { type: 'PERSIST_MAP_STATE'; stepId: string; zoom: number; center: [number, number]; bounds?: [[number, number], [number, number]] }

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
    notifications: []
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
// REDUCER
// ─────────────────────────────────────────────────────────────────────────────

function appReducer(state: AppState, action: AppAction): AppState {
    switch (action.type) {

        // ── Mode & Tool ────────────────────────────────────────────────────
        case 'SET_MODE':
            return { ...state, active_mode: action.mode };

        case 'SET_ACTIVE_TOOL':
            return { ...state, active_tool: action.tool, anchor_stage_idx: -1 };

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
            // After insertion, move anchor to end of list
            const newAnchor = labeledStages.length - 1;
            return { ...state, stages: labeledStages, routes: newRoutes, anchor_stage_idx: newAnchor };
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
            return { ...state, stages: relabeled, routes: newRoutes, anchor_stage_idx: relabeled.length - 1 };
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
            return { ...state, stages: relabeled, routes: newRoutes };
        }

        case 'MOVE_STAGE': {
            pushHistory(state);
            return {
                ...state,
                stages: state.stages.map(s =>
                    s.id === action.id ? { ...s, coords: [action.lat, action.lon], address: action.address !== undefined ? action.address : s.address } : s
                )
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

        // ── Route management ───────────────────────────────────────────────
        case 'ADD_ROUTE': {
            const newRoutes = [...state.routes];
            if (action.insertIdx !== undefined && action.insertIdx >= 0 && action.insertIdx < Math.max(1, state.stages.length)) {
                newRoutes[action.insertIdx] = action.route;
            } else {
                // Fallback (should not happen if mapped properly)
                newRoutes.push(action.route);
            }
            return { ...state, routes: newRoutes };
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
                            zoom: action.zoom,
                            center: action.center,
                            bounds: action.bounds,
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

    const merged: CarnetStep[] = [steps[0]];
    for (let i = 1; i < steps.length; i++) {
        const prev = merged[merged.length - 1];
        const curr = steps[i];

        // Only merge if both are non-manual and have the same module
        if (!prev.isManual && !curr.isManual && prev.moduleId === curr.moduleId) {
            merged[merged.length - 1] = {
                ...prev,
                toLabel: curr.toLabel,
                distanceM: prev.distanceM + curr.distanceM,
                coords: [...prev.coords, ...curr.coords],
                solutionText: prev.solutionText + '\n' + curr.solutionText,
                encodedText: prev.encodedText + '\n' + curr.encodedText,
                warnings: [...prev.warnings, ...curr.warnings],
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

export const AppContext = createContext<{
    state: AppState;
    dispatch: React.Dispatch<AppAction>;
}>({ state: initialState, dispatch: () => null });

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(appReducer, initialState);
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
                    const fromCache = result.fromCache ? ' [CACHED]' : '';
                    console.log(`[Pipeline ①] BRouter done  legKey=${legKey}${fromCache}`);

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
