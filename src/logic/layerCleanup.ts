// src/logic/layerCleanup.ts - Layer lifecycle, empty-layer purging and active itinerary sync
import type { AppState } from './types';

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

/**
 * Automatically purges empty layers when leaving their editing tool:
 * - Empty itineraries (0 stages & 0 manual steps) when leaving route tools
 * - Empty draw annotations (0 strokes or all strokes < 2 pts) when leaving draw tool
 * - Incomplete area annotations (< 3 coords) when leaving area tool
 * - Invalid point annotations (< 2 coords) when leaving point tool
 * - All empty layers across all kinds when switching mode (e.g. Map -> Textual/Carnet)
 */
export function cleanupEmptyLayers(state: AppState, incomingTool?: string): AppState {
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
export function syncActiveItineraryRoutes(state: AppState): AppState {
    const activeId = state.active_itinerary_id;
    if (!activeId) return state;
    return {
        ...state,
        itineraries: (state.itineraries || []).map(it =>
            it.id === activeId ? { ...it, routes: state.routes } : it
        ),
    };
}

/**
 * Ensure active itinerary is synchronized with current active itinerary properties
 */
export function syncActiveItinerary(nextState: AppState): AppState {
    if (!nextState.itineraries || nextState.itineraries.length === 0) {
        const defaultId = 'itin-1';
        return {
            ...nextState,
            itineraries: [{
                id: defaultId,
                name: 'Itinéraire 1',
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
