/**
 * toolCursors.ts — Bespoke high-contrast 32×32 SVG mouse cursors for every map tool,
 * including context-aware object-hover cursors that show what clicking/interacting
 * with a map object (route segment, repère, vertex, etc.) will do.
 *
 * Every cursor uses a dual-halo (dark #09090B outer outline + bright #FFFFFF / accent
 * inner stroke) so it remains legible over any basemap (IGN Scan25, Satellite, Dark, OSM).
 */

const HALO = '#09090B';

/** Wrap an SVG body in a 32×32 data-URI cursor with exact hotspot and CSS fallback. */
function svgCursor(body: string, hotX: number, hotY: number, fallback: string): string {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none">${body}</svg>`;
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hotX} ${hotY}, ${fallback}`;
}

/** High-contrast precision crosshair with center gap and 1px aiming dot. */
function crosshair(cx: number, cy: number, arm = 8, gap = 3): string {
    const lines = [
        `M${cx} ${cy - arm} V${cy - gap}`,
        `M${cx} ${cy + gap} V${cy + arm}`,
        `M${cx - arm} ${cy} H${cx - gap}`,
        `M${cx + gap} ${cy} H${cx + arm}`,
    ].join(' ');
    return [
        `<path d="${lines}" stroke="${HALO}" stroke-width="3.2" stroke-linecap="round"/>`,
        `<circle cx="${cx}" cy="${cy}" r="1.4" fill="${HALO}"/>`,
        `<path d="${lines}" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round"/>`,
        `<circle cx="${cx}" cy="${cy}" r="0.9" fill="#FFFFFF"/>`,
    ].join('');
}

/** Crisp pointer arrow with dark halo, tip at (5, 4). */
function pointerArrow(fill = '#FFFFFF'): string {
    return `<path d="M5 4 L5 20 L9.5 15.8 L13 22.5 L15.4 21.3 L11.9 14.6 L17.5 14.2 Z" fill="${fill}" stroke="${HALO}" stroke-width="2" stroke-linejoin="round"/>`;
}

/** Magnetic snap ring around (cx, cy) indicating snapping/action on an existing object. */
function snapRing(cx: number, cy: number, r: number, color: string): string {
    return (
        `<circle cx="${cx}" cy="${cy}" r="${r}" stroke="${HALO}" stroke-width="2.8"/>` +
        `<circle cx="${cx}" cy="${cy}" r="${r}" stroke="${color}" stroke-width="1.4"/>`
    );
}

const TOOL_CURSORS: Record<string, string> = {
    // 1. Tracé pédestre (BRouter) — Precision crosshair + curved trail & waypoints
    route: svgCursor(
        crosshair(16, 16, 8, 3) +
        `<path d="M19 27 C21 21, 25 27, 28 21" stroke="${HALO}" stroke-width="3.4" stroke-linecap="round"/>` +
        `<path d="M19 27 C21 21, 25 27, 28 21" stroke="#3B82F6" stroke-width="1.8" stroke-linecap="round"/>` +
        `<circle cx="19" cy="27" r="2.2" fill="#FFFFFF" stroke="${HALO}" stroke-width="1.2"/>` +
        `<circle cx="28" cy="21" r="2.2" fill="#3B82F6" stroke="${HALO}" stroke-width="1.2"/>`,
        16, 16, 'crosshair'
    ),

    // 2. Polygonal direct / Hors piste — Precision crosshair + straight vector & square vertices
    route_direct: svgCursor(
        crosshair(16, 16, 8, 3) +
        `<path d="M19 27 L24 20 L29 25" stroke="${HALO}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>` +
        `<path d="M19 27 L24 20 L29 25" stroke="#F59E0B" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>` +
        `<rect x="17.5" y="25.5" width="3" height="3" rx="0.6" fill="#FFFFFF" stroke="${HALO}" stroke-width="1"/>` +
        `<rect x="22.5" y="18.5" width="3" height="3" rx="0.6" fill="#F59E0B" stroke="${HALO}" stroke-width="1"/>` +
        `<rect x="27.5" y="23.5" width="3" height="3" rx="0.6" fill="#FFFFFF" stroke="${HALO}" stroke-width="1"/>`,
        16, 16, 'crosshair'
    ),

    // 3. Édition des nœuds — Diamond vertex reticle + add-node badge
    node: svgCursor(
        `<path d="M16 5 V9 M16 23 V27 M5 16 H9 M23 16 H27" stroke="${HALO}" stroke-width="3" stroke-linecap="round"/>` +
        `<path d="M16 10.5 L21.5 16 L16 21.5 L10.5 16 Z" stroke="${HALO}" stroke-width="3.2" stroke-linejoin="round"/>` +
        `<path d="M16 5 V9 M16 23 V27 M5 16 H9 M23 16 H27" stroke="#FFFFFF" stroke-width="1.4" stroke-linecap="round"/>` +
        `<path d="M16 10.5 L21.5 16 L16 21.5 L10.5 16 Z" fill="#09090B" fill-opacity="0.35" stroke="#38BDF8" stroke-width="1.6" stroke-linejoin="round"/>` +
        `<circle cx="16" cy="16" r="1.4" fill="#FFFFFF"/>` +
        `<path d="M25 22 V28 M22 25 H28" stroke="${HALO}" stroke-width="3" stroke-linecap="round"/>` +
        `<path d="M25 22 V28 M22 25 H28" stroke="#38BDF8" stroke-width="1.5" stroke-linecap="round"/>`,
        16, 16, 'crosshair'
    ),

    // 4. Visée & Calcul d'azimut — Topographic compass reticle with NNE needle
    azimut: svgCursor(
        `<circle cx="16" cy="16" r="8.5" stroke="${HALO}" stroke-width="3.2"/>` +
        `<path d="M16 4.5 V7.5 M16 24.5 V27.5 M4.5 16 H7.5 M24.5 16 H27.5" stroke="${HALO}" stroke-width="3" stroke-linecap="round"/>` +
        `<circle cx="16" cy="16" r="8.5" stroke="#FFFFFF" stroke-width="1.5"/>` +
        `<path d="M16 4.5 V7.5 M16 24.5 V27.5 M4.5 16 H7.5 M24.5 16 H27.5" stroke="#FFFFFF" stroke-width="1.4" stroke-linecap="round"/>` +
        `<polygon points="19.5,9.5 17.4,16.8 14.6,15.2" fill="#EF4444" stroke="${HALO}" stroke-width="0.9" stroke-linejoin="round"/>` +
        `<polygon points="12.5,22.5 14.6,15.2 17.4,16.8" fill="#FFFFFF" stroke="${HALO}" stroke-width="0.9" stroke-linejoin="round"/>` +
        `<circle cx="16" cy="16" r="1.4" fill="#F59E0B" stroke="${HALO}" stroke-width="0.8"/>`,
        16, 16, 'crosshair'
    ),

    // 6. Repère — Map pin whose sharp bottom tip lands exactly on (16, 26)
    annotate_point: svgCursor(
        `<path d="M16 26 L15 28 M16 26 L17 28" stroke="${HALO}" stroke-width="2" stroke-linecap="round"/>` +
        `<path d="M16 5 C11.6 5 8 8.6 8 13 C8 18.6 16 26 16 26 C16 26 24 18.6 24 13 C24 8.6 20.4 5 16 5 Z" fill="#3B82F6" stroke="${HALO}" stroke-width="2.2" stroke-linejoin="round"/>` +
        `<path d="M16 5 C11.6 5 8 8.6 8 13 C8 18.6 16 26 16 26 C16 26 24 18.6 24 13 C24 8.6 20.4 5 16 5 Z" fill="none" stroke="#FFFFFF" stroke-width="0.9" stroke-linejoin="round"/>` +
        `<circle cx="16" cy="13" r="3" fill="#FFFFFF" stroke="${HALO}" stroke-width="1"/>`,
        16, 26, 'crosshair'
    ),

    // 7. Zone libre polygonale — Crosshair at (10, 10) + polygonal zone badge
    annotate_area: svgCursor(
        crosshair(10, 10, 6, 2.5) +
        `<polygon points="17,20 23,16 28,21 25,28 18,27" fill="#22C55E" fill-opacity="0.35" stroke="${HALO}" stroke-width="3" stroke-linejoin="round"/>` +
        `<polygon points="17,20 23,16 28,21 25,28 18,27" fill="none" stroke="#22C55E" stroke-width="1.5" stroke-linejoin="round"/>` +
        `<circle cx="17" cy="20" r="1.6" fill="#FFFFFF" stroke="${HALO}" stroke-width="0.9"/>` +
        `<circle cx="23" cy="16" r="1.6" fill="#FFFFFF" stroke="${HALO}" stroke-width="0.9"/>` +
        `<circle cx="28" cy="21" r="1.6" fill="#FFFFFF" stroke="${HALO}" stroke-width="0.9"/>` +
        `<circle cx="25" cy="28" r="1.6" fill="#FFFFFF" stroke="${HALO}" stroke-width="0.9"/>` +
        `<circle cx="18" cy="27" r="1.6" fill="#FFFFFF" stroke="${HALO}" stroke-width="0.9"/>`,
        10, 10, 'crosshair'
    ),

    // 8. Zone sur sentiers BRouter — Crosshair at (10, 10) + curved trail-routed polygon badge
    annotate_area_routed: svgCursor(
        crosshair(10, 10, 6, 2.5) +
        `<path d="M17 20 Q21 15 25 18 Q29 21 26 27 Q21 29 17 25 Z" fill="#3B82F6" fill-opacity="0.3" stroke="${HALO}" stroke-width="3" stroke-linejoin="round"/>` +
        `<path d="M17 20 Q21 15 25 18 Q29 21 26 27 Q21 29 17 25 Z" fill="none" stroke="#3B82F6" stroke-width="1.5" stroke-dasharray="2.5 1.5" stroke-linejoin="round"/>` +
        `<circle cx="17" cy="20" r="1.7" fill="#FFFFFF" stroke="${HALO}" stroke-width="0.9"/>` +
        `<circle cx="25" cy="18" r="1.7" fill="#FFFFFF" stroke="${HALO}" stroke-width="0.9"/>` +
        `<circle cx="26" cy="27" r="1.7" fill="#FFFFFF" stroke="${HALO}" stroke-width="0.9"/>`,
        10, 10, 'crosshair'
    ),

    // 9. Dessin libre au pinceau — Angled precision pen/brush with drawing nib at (5, 27)
    annotate_draw: svgCursor(
        `<path d="M5 27 L7.5 19.5 L21.5 5.5 C22.9 4.1 25.1 4.1 26.5 5.5 C27.9 6.9 27.9 9.1 26.5 10.5 L12.5 24.5 Z" fill="#FFFFFF" stroke="${HALO}" stroke-width="2" stroke-linejoin="round"/>` +
        `<path d="M5 27 L7.5 19.5 L12.5 24.5 Z" fill="#EF4444" stroke="${HALO}" stroke-width="1.5" stroke-linejoin="round"/>` +
        `<path d="M19.5 7.5 L24.5 12.5" stroke="${HALO}" stroke-width="1.6"/>` +
        `<circle cx="5" cy="27" r="1" fill="#EF4444"/>`,
        5, 27, 'crosshair'
    ),

    // 10. Texte libre sur carte — I-beam text placement reticle at (16, 16) + sky-blue 'T' badge
    annotate_text: svgCursor(
        `<path d="M16 7 V25 M12 7 H20 M12 25 H20" stroke="${HALO}" stroke-width="3.2" stroke-linecap="round"/>` +
        `<path d="M16 7 V25 M12 7 H20 M12 25 H20" stroke="#FFFFFF" stroke-width="1.5" stroke-linecap="round"/>` +
        `<path d="M21 20 H28 M24.5 20 V28" stroke="${HALO}" stroke-width="3.2" stroke-linecap="round"/>` +
        `<path d="M21 20 H28 M24.5 20 V28" stroke="#38BDF8" stroke-width="1.6" stroke-linecap="round"/>`,
        16, 16, 'text'
    ),
};

/**
 * Context-aware cursors when hovering an interactive map object (.leaflet-interactive)
 * so the user immediately sees what clicking/interacting with that object will do.
 */
const TOOL_OBJECT_CURSORS: Record<string, string> = {
    // Route: clicking a direct segment converts it to pedestrian BRouter trail
    route: svgCursor(
        pointerArrow('#3B82F6') +
        `<path d="M18 26 C20 20, 25 26, 28 20" stroke="${HALO}" stroke-width="3.4" stroke-linecap="round"/>` +
        `<path d="M18 26 C20 20, 25 26, 28 20" stroke="#60A5FA" stroke-width="1.8" stroke-linecap="round"/>` +
        `<circle cx="18" cy="26" r="2" fill="#FFFFFF" stroke="${HALO}" stroke-width="1"/>` +
        `<circle cx="28" cy="20" r="2" fill="#3B82F6" stroke="${HALO}" stroke-width="1"/>`,
        5, 4, 'pointer'
    ),

    // Route direct: clicking a pedestrian segment converts it to straight off-road line
    route_direct: svgCursor(
        pointerArrow('#F59E0B') +
        `<path d="M18 26 L28 20" stroke="${HALO}" stroke-width="3.4" stroke-linecap="round"/>` +
        `<path d="M18 26 L28 20" stroke="#FBBF24" stroke-width="1.8" stroke-linecap="round"/>` +
        `<rect x="16.5" y="24.5" width="3" height="3" rx="0.6" fill="#FFFFFF" stroke="${HALO}" stroke-width="1"/>` +
        `<rect x="26.5" y="18.5" width="3" height="3" rx="0.6" fill="#F59E0B" stroke="${HALO}" stroke-width="1"/>`,
        5, 4, 'pointer'
    ),

    // Node: hovering a route segment shows a highlighted insert-node (+) target
    node: svgCursor(
        snapRing(16, 16, 6.5, '#38BDF8') +
        `<path d="M16 11 L21 16 L16 21 L11 16 Z" fill="#38BDF8" stroke="${HALO}" stroke-width="1.6" stroke-linejoin="round"/>` +
        `<path d="M25 22 V28 M22 25 H28" stroke="${HALO}" stroke-width="3.2" stroke-linecap="round"/>` +
        `<path d="M25 22 V28 M22 25 H28" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round"/>`,
        16, 16, 'pointer'
    ),

    // Azimut: hovering a segment shows active azimuth compass lock
    azimut: svgCursor(
        snapRing(16, 16, 9.5, '#F59E0B') +
        `<polygon points="19.5,9.5 17.4,16.8 14.6,15.2" fill="#EF4444" stroke="${HALO}" stroke-width="0.9" stroke-linejoin="round"/>` +
        `<polygon points="12.5,22.5 14.6,15.2 17.4,16.8" fill="#FFFFFF" stroke="${HALO}" stroke-width="0.9" stroke-linejoin="round"/>` +
        `<circle cx="16" cy="16" r="1.6" fill="#F59E0B" stroke="${HALO}" stroke-width="0.8"/>`,
        16, 16, 'pointer'
    ),

    // Area: hovering a vertex/polygon shows magnetic snap ring to close/anchor
    annotate_area: svgCursor(
        snapRing(10, 10, 5.5, '#22C55E') +
        crosshair(10, 10, 5, 2) +
        `<polygon points="17,20 23,16 28,21 25,28 18,27" fill="#22C55E" fill-opacity="0.5" stroke="${HALO}" stroke-width="2.8" stroke-linejoin="round"/>` +
        `<polygon points="17,20 23,16 28,21 25,28 18,27" fill="none" stroke="#FFFFFF" stroke-width="1.3" stroke-linejoin="round"/>`,
        10, 10, 'pointer'
    ),

    annotate_area_routed: svgCursor(
        snapRing(10, 10, 5.5, '#3B82F6') +
        crosshair(10, 10, 5, 2) +
        `<path d="M17 20 Q21 15 25 18 Q29 21 26 27 Q21 29 17 25 Z" fill="#3B82F6" fill-opacity="0.45" stroke="${HALO}" stroke-width="2.8" stroke-linejoin="round"/>` +
        `<path d="M17 20 Q21 15 25 18 Q29 21 26 27 Q21 29 17 25 Z" fill="none" stroke="#FFFFFF" stroke-width="1.3" stroke-dasharray="2.5 1.5" stroke-linejoin="round"/>`,
        10, 10, 'pointer'
    ),

    // Draw & Text keep their tool cursor over background paths so drawing/placing doesn't flicker
    annotate_draw: TOOL_CURSORS.annotate_draw,
    annotate_text: TOOL_CURSORS.annotate_text,
};

/** Special snap-to-repère cursor when hovering a [data-sr-point-id] with route tools. */
const SNAP_REPERE_ROUTE = svgCursor(
    snapRing(16, 16, 6.5, '#3B82F6') + crosshair(16, 16, 8, 3),
    16, 16, 'crosshair'
);
const SNAP_REPERE_DIRECT = svgCursor(
    snapRing(16, 16, 6.5, '#F59E0B') + crosshair(16, 16, 8, 3),
    16, 16, 'crosshair'
);

/**
 * Returns the CSS `cursor` value for the base map canvas for a given tool ID.
 */
export function getToolCursor(activeTool: string | undefined): string {
    if (!activeTool) return 'grab';
    return TOOL_CURSORS[activeTool] ?? 'grab';
}

/**
 * Generates CSS rules scoping object-hover cursors to `.leaflet-container[data-active-tool="..."]`
 * so hovering routes, polygons, and repères reflects the active tool's action.
 */
export function getToolCursorStyleSheet(): string {
    const rules = Object.entries(TOOL_OBJECT_CURSORS).map(
        ([tool, cursor]) =>
            `.leaflet-container[data-active-tool="${tool}"] .leaflet-interactive, ` +
            `.leaflet-container[data-active-tool="${tool}"] .leaflet-interactive > div { cursor: ${cursor}; }`
    );
    rules.push(
        `.leaflet-container[data-active-tool="route"] [data-sr-point-id] { cursor: ${SNAP_REPERE_ROUTE} !important; }`,
        `.leaflet-container[data-active-tool="route_direct"] [data-sr-point-id] { cursor: ${SNAP_REPERE_DIRECT} !important; }`
    );
    return rules.join('\n');
}
