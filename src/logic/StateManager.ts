/**
 * StateManager.ts — Complete React-compatible store with IPC persistence.
 * Ported from legacy/state_manager.py
 * 
 * Handles:
 * - Initial state creation
 * - State mutation helpers for the reducer
 * - Serialization / deserialization for .srdoc files
 * - IPC wrappers for Electron save/load/export
 */

import type { AppState, RouteDict, PolySegment, ExportJob } from './types';

const CURRENT_SCHEMA_VERSION = '5.0.0';

export class StateManager {

    // ─── Initial State ────────────────────────────────────────────────────
    static getInitialState(): AppState {
        // Default preferences
        let prefs = {
            active_ign_layer: 'PLAN.IGN',
            mapy_api_key: '',
            ign_api_key: '',
            show_pois_on_map: true,
            show_dangers_on_map: true,
            show_stages_on_map: true,
        };

        // Attempt to load from localStorage
        if (typeof window !== 'undefined') {
            try {
                const storedPrefs = localStorage.getItem('scoutraider_prefs');
                if (storedPrefs) {
                    const parsed = JSON.parse(storedPrefs);
                    if (parsed.active_ign_layer) prefs.active_ign_layer = parsed.active_ign_layer;
                    if (parsed.mapy_api_key) prefs.mapy_api_key = parsed.mapy_api_key;
                    if (parsed.ign_api_key) prefs.ign_api_key = parsed.ign_api_key;
                    if (parsed.show_pois_on_map !== undefined) prefs.show_pois_on_map = parsed.show_pois_on_map;
                    if (parsed.show_dangers_on_map !== undefined) prefs.show_dangers_on_map = parsed.show_dangers_on_map;
                    if (parsed.show_stages_on_map !== undefined) prefs.show_stages_on_map = parsed.show_stages_on_map;
                }
            } catch (e) {
                console.warn('Failed to load preferences from localStorage', e);
            }
        }

        return {
            version: CURRENT_SCHEMA_VERSION,
            active_mode: 'map',

            routes: [],
            active_route_id: null,
            route_chain: [],

            stages: [],
            geojson_data: null,

            polygonalization_settings: {
                tolerance: 45,
                allow_offroad: false,
                force_intersections: true,
                min_dist: 80,
                bypassed: false,
                masked_nodes: [],
                forced_nodes: []
            },
            polygonal_steps: [],
            polygonal_legs: {},
            pending_azimut_legs: [],

            distribution_mode: 'auto',
            active_preset_id: 'seconde_classe_1',
            custom_assignments: {},
            custom_languages: {},

            active_tool: 'route',
            anchor_stage_idx: -1,
            show_azimuth_arrows: false,
            active_ign_layer: prefs.active_ign_layer,
            mapy_api_key: prefs.mapy_api_key,
            ign_api_key: prefs.ign_api_key,
            small_roads_only: false,
            show_pois_on_map: prefs.show_pois_on_map,
            show_dangers_on_map: prefs.show_dangers_on_map,
            show_stages_on_map: prefs.show_stages_on_map,
            segment_pois: {},

            theme_id: 'Neutre',
            theme_overrides: {},

            carnet_steps: [],
            carnet_view: 'participant',
            carnet_include_general_map: true,
            enabled_annexes: [],

            export_queue: [],

            // Transient UI state
            is_loading: false,
            loading_text: '',
            notifications: []
        };
    }

    // ─── Serialization (for .scoutproj persistence) ───────────────────────

    /**
     * Serialize state for saving to a .srdoc file.
     * Strips transient UI fields and adds metadata.
     */
    static serializeForSave(state: AppState): string {
        // Deep clone and strip transient fields
        const persistable: any = { ...state };
        delete persistable.is_loading;
        delete persistable.loading_text;
        delete persistable.notifications;
        delete persistable.mapy_api_key;
        delete persistable.ign_api_key;

        const envelope = {
            _scoutproj: true,
            _version: CURRENT_SCHEMA_VERSION,
            _savedAt: new Date().toISOString(),
            state: persistable
        };

        return JSON.stringify(envelope, null, 2);
    }

    /**
     * Save only global preferences to localStorage.
     */
    static savePreferences(state: AppState) {
        if (typeof window === 'undefined') return;
        const prefs = {
            active_ign_layer: state.active_ign_layer,
            mapy_api_key: state.mapy_api_key,
            ign_api_key: state.ign_api_key,
            show_pois_on_map: state.show_pois_on_map,
            show_dangers_on_map: state.show_dangers_on_map,
            show_stages_on_map: state.show_stages_on_map,
        };
        localStorage.setItem('scoutraider_prefs', JSON.stringify(prefs));
    }

    /**
     * Deserialize a .srdoc JSON string back into AppState.
     * Handles schema migration for older versions.
     */
    static deserializeFromLoad(json: string): AppState {
        const data = JSON.parse(json);

        let loadedState: AppState;

        if (data._scoutproj) {
            // New format with envelope
            loadedState = data.state as AppState;
            loadedState.version = data._version || CURRENT_SCHEMA_VERSION;
        } else {
            // Legacy format: raw state object
            loadedState = data as AppState;
        }

        // Migrate missing fields from defaults
        const defaults = StateManager.getInitialState();
        const migrated: AppState = { ...defaults, ...loadedState };

        // Ensure transient fields are reset
        migrated.is_loading = false;
        migrated.loading_text = '';
        migrated.notifications = [];

        // Ensure arrays exist (protection against corrupted files)
        if (!Array.isArray(migrated.stages)) migrated.stages = [];
        if (!Array.isArray(migrated.routes)) migrated.routes = [];
        // Ensure arrays exist
        if (!Array.isArray(migrated.polygonal_steps)) migrated.polygonal_steps = [];
        if (!Array.isArray(migrated.carnet_steps)) migrated.carnet_steps = [];
        
        // Migrate legacy top-level nodes if necessary
        const legacyMasked = (loadedState as any).masked_nodes;
        if (Array.isArray(legacyMasked) && migrated.polygonalization_settings.masked_nodes.length === 0) {
            migrated.polygonalization_settings.masked_nodes = legacyMasked;
        }
        const legacyForced = (loadedState as any).forced_nodes;
        if (Array.isArray(legacyForced) && migrated.polygonalization_settings.forced_nodes.length === 0) {
            migrated.polygonalization_settings.forced_nodes = legacyForced;
        }

        if (!Array.isArray(migrated.polygonalization_settings.masked_nodes)) migrated.polygonalization_settings.masked_nodes = [];
        if (!Array.isArray(migrated.polygonalization_settings.forced_nodes)) migrated.polygonalization_settings.forced_nodes = [];

        return migrated;
    }

    /**
     * Generate a human-readable project summary for display.
     */
    static exportProjectSummary(state: AppState): {
        stageCount: number;
        totalDistanceKm: number;
        segmentCount: number;
        themeId: string;
        presetId: string;
        moduleCount: number;
    } {
        const totalDist = state.routes.reduce((acc: number, r: any) => {
            const dist = r.distance_m || r.geojson?.properties?.total_distance || 0;
            return acc + dist;
        }, 0);

        const uniqueModules = new Set(
            state.polygonal_steps
                .map(s => s.assigned_module)
                .filter(Boolean)
        );

        return {
            stageCount: state.stages.length,
            totalDistanceKm: totalDist / 1000,
            segmentCount: state.polygonal_steps.length,
            themeId: state.theme_id,
            presetId: state.active_preset_id,
            moduleCount: uniqueModules.size
        };
    }

    // ─── IPC Wrappers (Electron integration) ──────────────────────────────

    /**
     * Save project via Electron IPC or browser fallback.
     */
    static async saveProject(state: AppState, filepath?: string): Promise<boolean> {
        const json = StateManager.serializeForSave(state);

        if (typeof window !== 'undefined' && (window as any).electronAPI?.saveScoutproj) {
            try {
                await (window as any).electronAPI.saveScoutproj(json, filepath);
                return true;
            } catch (e) {
                console.error('Failed to save via IPC:', e);
                return false;
            }
        }
        
        // Web fallback: download file
        if (typeof document !== 'undefined') {
            const blob = new Blob([json], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = filepath || 'projet.srdoc';
            a.click();
            URL.revokeObjectURL(a.href);
            return true;
        }

        return false;
    }

    /**
     * Load project via Electron IPC dialog or raw JSON string.
     */
    static async loadProject(jsonOrPath?: string): Promise<AppState | null> {
        if (typeof window !== 'undefined' && (window as any).electronAPI?.openScoutproj) {
            try {
                const result = await (window as any).electronAPI.openScoutproj();
                if (!result) return null; // user cancelled
                return StateManager.deserializeFromLoad(result.state);
            } catch (e) {
                console.error('Failed to load via IPC:', e);
                return null;
            }
        }

        // Direct JSON string (e.g. from drag-and-drop)
        if (jsonOrPath) {
            try {
                return StateManager.deserializeFromLoad(jsonOrPath);
            } catch (e) {
                return null;
            }
        }

        // Web fallback: trigger file input
        if (typeof document !== 'undefined') {
            return new Promise((resolve) => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.srdoc,.scoutproj,application/json';
                input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (!file) {
                        resolve(null);
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = (re) => {
                        const content = re.target?.result as string;
                        try {
                            resolve(StateManager.deserializeFromLoad(content));
                        } catch (err) {
                            console.error('Failed to parse file:', err);
                            resolve(null);
                        }
                    };
                    reader.readAsText(file);
                };
                input.click();
            });
        }

        return null;
    }

    /**
     * Export HTML/PDF via Electron IPC.
     */
    static async exportFile(html: string, format: 'pdf' | 'html', outputPath: string): Promise<boolean> {
        if (typeof window !== 'undefined' && (window as any).electronAPI?.exportFile) {
            try {
                return await (window as any).electronAPI.exportFile(html, format, outputPath);
            } catch (e) {
                console.error('Export failed:', e);
                return false;
            }
        }

        // Web fallback: open in new tab
        if (format === 'html') {
            const blob = new Blob([html], { type: 'text/html' });
            window.open(URL.createObjectURL(blob), '_blank');
            return true;
        }

        return false;
    }

    // ─── Immutable State Mutations (used by AppContext reducer) ────────────

    static addRoute(prev: AppState, route: RouteDict): AppState {
        return { ...prev, routes: [...prev.routes, route] };
    }

    static updateRoute(prev: AppState, id: string, updater: (r: RouteDict) => RouteDict): AppState {
        return { 
            ...prev, 
            routes: prev.routes.map(r => r.id === id ? updater(r) : r) 
        };
    }

    static setPolygonalSegments(prev: AppState, legKey: string, segments: PolySegment[]): AppState {
        const segsWithKey = segments.map(s => ({ ...s, leg_key: legKey }));
        return {
            ...prev,
            polygonal_legs: {
                ...prev.polygonal_legs,
                [legKey]: segsWithKey
            }
        };
    }

    static rebuildPolygonalSteps(prev: AppState): AppState {
        let steps: PolySegment[] = [];
        // Use the routes array order as the source of truth for the itinerary legs
        for (const route of prev.routes) {
            const legId = route.id;
            if (prev.polygonal_legs[legId]) {
                const mappedSegs = prev.polygonal_legs[legId].map(s => ({ ...s, leg_key: legId }));
                steps = steps.concat(mappedSegs);
            }
        }
        return { ...prev, polygonal_steps: steps };
    }
}
