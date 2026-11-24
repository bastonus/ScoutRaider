// src/logic/reducers/routesReducer.ts - Reducer for Stages, Routes, Itineraries & Polygonalisation
import type { AppState, Stage, Itinerary } from '../types';
import type { AppAction } from '../../AppContext';
import { StateManager } from '../StateManager';
import { backgroundEngine } from '../BackgroundEngine';
import { pushHistory } from '../historyManager';
import { syncActiveItineraryRoutes } from '../layerCleanup';
import { autoRebuildCarnet, regenerateStepTexts } from '../carnetAutoRebuild';

export function routesReducer(state: AppState, action: AppAction): AppState | null {
    switch (action.type) {
        // ── Stage management ───────────────────────────────────────────────
        case 'SET_ANCHOR_STAGE':
            return { ...state, anchor_stage_idx: action.idx };

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
            const labeledStages: Stage[] = newStages.map((s, i) => ({
                ...s,
                coords: [s.coords[0], s.coords[1]] as [number, number],
                label: String.fromCharCode(65 + i)
            }));
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
            const relabeled: Stage[] = inserted.map((s, i) => ({
                ...s,
                coords: [s.coords[0], s.coords[1]] as [number, number],
                label: String.fromCharCode(65 + i)
            }));
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
            const relabeled: Stage[] = newStages.map((s, i) => ({
                ...s,
                coords: [s.coords[0], s.coords[1]] as [number, number],
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
            const movedStages: Stage[] = state.stages.map(s =>
                s.id === action.id ? { ...s, coords: [action.lat, action.lon] as [number, number], address: action.address !== undefined ? action.address : s.address } : s
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
            const reordered: Stage[] = action.stages.map((s, i) => ({
                ...s,
                coords: [s.coords[0], s.coords[1]] as [number, number],
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
            for (let i = 0; i < inverted.length - 1; i++) {
                backgroundEngine.enqueue('route_leg', 0, `job-invert-${Date.now()}-${i}`, {
                    p1: [inverted[i].coords[0], inverted[i].coords[1]],
                    p2: [inverted[i + 1].coords[0], inverted[i + 1].coords[1]],
                    profile: 'pedestrian', small_roads: state.small_roads_only, insertIdx: i
                });
            }
            return {
                ...state,
                stages: inverted,
                routes: [],
                is_loading: inverted.length > 1,
                loading_text: "Inversion de l'itinéraire..."
            };
        }

        // ── Multi-itinerary management (Layer Manager) ────────────────────
        case 'ADD_ITINERARY': {
            pushHistory(state);
            const existing = state.itineraries || [];
            const colors = ['#2d8ceb', '#f97316', '#10b981', '#8b5cf6', '#ec4899', '#06b6d4', '#eab308'];

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
                    carnet_steps: [],
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

        // ── Route management ───────────────────────────────────────────────
        case 'ADD_ROUTE': {
            const newRoutes = [...state.routes];
            if (action.insertIdx !== undefined && action.insertIdx >= 0 && action.insertIdx < Math.max(1, state.stages.length)) {
                newRoutes[action.insertIdx] = action.route;
            } else {
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
            const enrichedSteps = action.steps.map((seg: any) => {
                if (seg.leg_key) return seg;
                
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
            
            const newCarnetSteps = state.carnet_steps.map(step => {
                if (!step.segmentIndices || !step.segmentIndices.includes(action.segIdx)) return step;
                
                const isFirst = step.segmentIndices[0] === action.segIdx;
                const newAzimuth = isFirst ? action.azimut : step.azimuth;

                return regenerateStepTexts({ ...step, azimuth: newAzimuth }, { ...state, polygonal_steps: updatedSteps });
            });

            return { ...state, polygonal_steps: updatedSteps, carnet_steps: newCarnetSteps };
        }

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

        default:
            return null;
    }
}
