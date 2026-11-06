import type { Itinerary, PointAnnotation, AreaAnnotation, DrawAnnotation } from './types';

/**
 * Layer list order = map z-order.
 *
 * The first item of the list is drawn on top of the map (highest z-index),
 * the last item is drawn underneath the others.
 */
export type LayerKind = 'itin' | 'point' | 'area' | 'draw';

export interface LayerOrderItem {
    kind: LayerKind;
    id: string;
}

export interface ComputeLayerOrderInput {
    itineraries: Itinerary[];
    points: PointAnnotation[];
    areas: AreaAnnotation[];
    draws: DrawAnnotation[];
    savedOrder?: LayerOrderItem[] | null;
    /** In-memory order fallback used before the order has been persisted. */
    currentOrder?: LayerOrderItem[] | null;
    selectedId?: string | null;
}

/**
 * Build the current layer order from the persisted order and the current
 * layer collections. New items are inserted above the current selection
 * (or at the top when nothing is selected), matching the layer panel.
 */
export function computeLayerOrder({
    itineraries,
    points,
    areas,
    draws,
    savedOrder,
    currentOrder,
    selectedId,
}: ComputeLayerOrderInput): LayerOrderItem[] {
    const all: LayerOrderItem[] = [
        ...(itineraries || []).map(x => ({ kind: 'itin' as const, id: x.id })),
        ...(points || []).map(x => ({ kind: 'point' as const, id: x.id })),
        ...(areas || []).map(x => ({ kind: 'area' as const, id: x.id })),
        ...(draws || []).map(x => ({ kind: 'draw' as const, id: x.id })),
    ];

    const allIds = new Set(all.map(x => x.id));
    const baseOrder = savedOrder && savedOrder.length > 0
        ? savedOrder
        : (currentOrder || []);
    const prevIds = new Set(baseOrder.map(x => x.id));
    const kept = baseOrder.filter(x => allIds.has(x.id));
    const added = all.filter(x => !prevIds.has(x.id));

    if (added.length === 0) {
        return kept.length === baseOrder.length ? baseOrder : kept;
    }

    const selectedIndex = selectedId ? kept.findIndex(x => x.id === selectedId) : -1;
    if (selectedIndex >= 0) {
        const copy = [...kept];
        copy.splice(selectedIndex, 0, ...added);
        return copy;
    }

    return [...added, ...kept];
}

export function layerOrdersEqual(a: LayerOrderItem[], b: LayerOrderItem[]): boolean {
    if (a === b) return true;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i].id !== b[i].id || a[i].kind !== b[i].kind) return false;
    }
    return true;
}

// ── Leaflet panes ────────────────────────────────────────────────────────────
// Each layer gets its own pane so that its z-index can follow the panel order.
// Panes stay below Leaflet's marker/tooltip/popup panes (600/650/700) so that
// popups and editing handles always remain above the map content.
export const LAYER_PANE_PREFIX = 'sr-layer-';

const LAYER_PANE_Z_MIN = 410;
const LAYER_PANE_Z_MAX = 590;

export function layerPaneName(id: string): string {
    return `${LAYER_PANE_PREFIX}${id}`;
}

/** z-index for an item at `index` in the list (0 = top of the list). */
export function layerPaneZIndex(index: number, total: number): number {
    if (total <= 1) return LAYER_PANE_Z_MAX;
    const clamped = Math.max(0, Math.min(index, total - 1));
    return Math.round(LAYER_PANE_Z_MAX - (clamped * (LAYER_PANE_Z_MAX - LAYER_PANE_Z_MIN)) / (total - 1));
}
