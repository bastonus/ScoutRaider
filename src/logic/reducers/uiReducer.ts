// src/logic/reducers/uiReducer.ts - Reducer for UI modes, tools, theme, preferences, undo/redo, notifications & cloud sync
import type { AppState } from '../types';
import type { AppAction } from '../../AppContext';
import { themeManager } from '../ThemeManager';
import { presetsManager } from '../PresetsManager';
import { StateManager } from '../StateManager';
import { pushHistory, popUndo, popRedo, clearHistory } from '../historyManager';
import { cleanupEmptyLayers } from '../layerCleanup';
import { autoRebuildCarnet, regenerateStepTexts } from '../carnetAutoRebuild';

export function uiReducer(state: AppState, action: AppAction, getInitialState: () => AppState): AppState | null {
    switch (action.type) {
        // ── Mode & Tool ────────────────────────────────────────────────────
        case 'SET_MODE': {
            const cleaned = cleanupEmptyLayers(state);
            return { ...cleaned, active_mode: action.mode };
        }

        case 'SET_ACTIVE_TOOL': {
            const cleaned = cleanupEmptyLayers(state, action.tool);
            const routeTools = ['route', 'route_direct', 'node', 'azimut'];
            let nextSelectedLayerId = cleaned.selected_layer_id;
            let nextActiveItinId = cleaned.active_itinerary_id;
            let nextStages = cleaned.stages;
            let nextRoutes = cleaned.routes;
            let nextPolySteps = cleaned.polygonal_steps;
            let nextPolyLegs = cleaned.polygonal_legs;
            let nextCarnet = cleaned.carnet_steps;
            let nextCustomAssignments = cleaned.custom_assignments;
            let nextCustomLangs = cleaned.custom_languages;

            if (routeTools.includes(action.tool)) {
                if (!nextActiveItinId && cleaned.itineraries.length > 0) {
                    const first = cleaned.itineraries[0];
                    nextActiveItinId = first.id;
                    nextStages = first.stages || [];
                    nextRoutes = first.routes || [];
                    nextPolySteps = first.polygonal_steps || [];
                    nextPolyLegs = first.polygonal_legs || {};
                    nextCarnet = first.carnet_steps || [];
                    nextCustomAssignments = first.custom_assignments || {};
                    nextCustomLangs = first.custom_languages || {};
                }
                if (nextActiveItinId) {
                    nextSelectedLayerId = nextActiveItinId;
                }
            } else if (action.tool === 'annotate_area' || action.tool === 'annotate_area_routed') {
                const isArea = (cleaned.area_annotations || []).some(a => a.id === nextSelectedLayerId);
                if (!isArea) nextSelectedLayerId = null;
            } else if (action.tool === 'annotate_draw') {
                const isDraw = (cleaned.draw_annotations || []).some(d => d.id === nextSelectedLayerId);
                if (!isDraw) nextSelectedLayerId = null;
            } else if (action.tool === 'annotate_text') {
                const isText = (cleaned.text_annotations || []).some(t => t.id === nextSelectedLayerId);
                if (!isText) nextSelectedLayerId = null;
            } else if (action.tool === 'annotate_point') {
                const isPoint = (cleaned.point_annotations || []).some(p => p.id === nextSelectedLayerId);
                if (!isPoint) nextSelectedLayerId = null;
            }

            return {
                ...cleaned,
                active_tool: action.tool,
                selected_layer_id: nextSelectedLayerId,
                selected_sublayer_id: null,
                active_itinerary_id: nextActiveItinId,
                stages: nextStages,
                routes: nextRoutes,
                polygonal_steps: nextPolySteps,
                polygonal_legs: nextPolyLegs,
                carnet_steps: nextCarnet,
                custom_assignments: nextCustomAssignments,
                custom_languages: nextCustomLangs,
            };
        }

        // ── Map Display Toggles ───────────────────────────────────────────
        case 'TOGGLE_POIS_ON_MAP':
            return { ...state, show_pois_on_map: !state.show_pois_on_map };

        case 'TOGGLE_DANGERS_ON_MAP':
            return { ...state, show_dangers_on_map: !state.show_dangers_on_map };

        case 'TOGGLE_STAGES_ON_MAP':
            return { ...state, show_stages_on_map: !state.show_stages_on_map };

        case 'TOGGLE_AZIMUTH_ARROWS':
            return { ...state, show_azimuth_arrows: !state.show_azimuth_arrows };

        // ── Theme & Configuration ─────────────────────────────────────────
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
            const undone = popUndo(state);
            return undone || state;
        }

        case 'REDO': {
            const redone = popRedo(state);
            return redone || state;
        }

        case 'SET_DOCUMENT_TITLE':
            return {
                ...state,
                document_title: action.title !== undefined ? action.title : 'Document sans titre',
                document_title_synced: true,
            };

        case 'SET_CURRENT_FILEPATH':
            return { ...state, current_filepath: action.filepath };

        case 'LOAD_PROJECT':
            clearHistory();
            return { ...action.state, notifications: [], is_loading: false, loading_text: '' };

        case 'NEW_PROJECT':
            clearHistory();
            return { ...getInitialState() };

        // ── UI Transient ───────────────────────────────────────────────────
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

        // ── Cloud Sync ────────────────────────────────────────────────────
        case 'SET_CLOUD_SYNC_STATUS':
            return {
                ...state,
                cloud_sync_status: action.status,
                cloud_last_synced: action.lastSynced ?? state.cloud_last_synced
            };

        case 'SET_CLOUD_PROJECT_ID':
            return { ...state, cloud_project_id: action.projectId };

        case 'SET_CLOUD_SHARE_TOKEN':
            return { ...state, cloud_share_token: action.token };

        case 'TRIGGER_AUTOSAVE':
            return state;

        case 'SET_AUTOSAVE_ENABLED':
            return { ...state, autosave_enabled: action.enabled };

        default:
            return null;
    }
}
