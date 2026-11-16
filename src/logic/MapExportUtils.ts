/**
 * MapExportUtils.ts — Utilitaires pour générer des SVG de cartes autonomes
 * avec tuiles intégrées en base64 (pour export PDF backend sans clés API).
 */

import { calculateSmartMapDimensions } from '../components/textual/MiniMap';

// ─── Constantes EPSG:3857 ─────────────────────────────────────────────────────
const SCALE_CONSTANT = 591657550.5;
const TILE_SIZE = 256;

/**
 * Projette une coordonnée (lat, lng) en pixels monde Web Mercator (EPSG:3857).
 */
export function latLngToWorldPixel(lat: number, lng: number, zoom: number): { x: number; y: number } {
    const latRad = (lat * Math.PI) / 180;
    const n = Math.pow(2, zoom);
    const x = ((lng + 180) / 360) * n * TILE_SIZE;
    const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n * TILE_SIZE;
    return { x, y };
}

/**
 * Calcule le zoom Leaflet pour une échelle dénominateur donnée.
 */
export function calculateZoomForScale(scaleDenominator: number, lat: number): number {
    const latRad = (lat * Math.PI) / 180;
    const cosLat = Math.cos(latRad);
    const z = Math.log2((SCALE_CONSTANT * cosLat) / scaleDenominator);
    return Math.round(z * 4) / 4;
}

/**
 * Génère les URLs des tuiles pour une couche donnée.
 */
export function getTileUrl(layerId: string, z: number, x: number, y: number, apiKeys: { ign?: string; mapy?: string } = {}): string {
    if (layerId === 'OSM') {
        return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
    }
    if (layerId === 'CYCLOSM') {
        return `https://tile-cyclosm.openstreetmap.fr/cyclosm/${z}/${x}/${y}.png`;
    }
    if (layerId === 'SAT.IGN') {
        return `https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX=${z}&TILEROW=${y}&TILECOL=${x}`;
    }
    if (layerId === 'MAPY_BASE') {
        return `https://api.mapy.cz/v1/tiles/85a8c5e27aa780e83a75/tiles/${z}/${x}/${y}?apikey=${apiKeys.mapy || ''}`;
    }
    if (layerId === 'MAPY_TOURISTIC') {
        return `https://api.mapy.cz/v1/tiles/85a8c5e27aa780e83a75/tiles-touristic/${z}/${x}/${y}?apikey=${apiKeys.mapy || ''}`;
    }
    if (layerId === 'MAPY_SATELLITE') {
        return `https://api.mapy.cz/v1/tiles/85a8c5e27aa780e83a75/tiles-satellite/${z}/${x}/${y}?apikey=${apiKeys.mapy || ''}`;
    }
    // Défaut Plan IGN v2 (nécessite clé API pour l'authentification)
    return `https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX=${z}&TILEROW=${y}&TILECOL=${x}`;
}

/**
 * Génère un SVG de carte statique avec tuiles (URLs externes).
 * Les tuiles devront être intégrées en base64 via inlineMapTiles().
 */
export function generateStaticMapSvg(params: {
    latLngs: [number, number][];
    center: [number, number];
    zoom: number;
    width: number;
    height: number;
    layerId?: string;
    showRoute?: boolean;
    showEndpoints?: boolean;
    showAnnotations?: boolean;
    pointAnnotations?: any[];
    areaAnnotations?: any[];
    apiKeys?: { ign?: string; mapy?: string };
}): { svg: string; formattedScale: string; tileUrls: string[] } {
    const { latLngs, center, zoom, width, height, layerId, showRoute, showEndpoints, showAnnotations, pointAnnotations, areaAnnotations, apiKeys = {} } = params;

    const W = Math.round(width);
    const H = Math.round(height);

    // zProj : zoom fractionnaire pour projections précises
    // zTile : entier strict pour URLs WMTS/OSM
    const zProj = Math.min(18, Math.max(8, zoom));
    const zTile = Math.min(18, Math.max(8, Math.round(zoom)));

    // Pixel monde du centre
    const cPx = latLngToWorldPixel(center[0], center[1], zProj);
    const originX = cPx.x - W / 2;
    const originY = cPx.y - H / 2;

    // Calcul tuiles requises (au zoom entier pour indices)
    const cPxTile = latLngToWorldPixel(center[0], center[1], zTile);
    const originXTile = cPxTile.x - W / 2;
    const originYTile = cPxTile.y - H / 2;
    const minTx = Math.floor(originXTile / TILE_SIZE);
    const maxTx = Math.floor((originXTile + W) / TILE_SIZE);
    const minTy = Math.floor(originYTile / TILE_SIZE);
    const maxTy = Math.floor((originYTile + H) / TILE_SIZE);

    let tilesSvg = '';
    const tileUrls: string[] = [];

    for (let ty = minTy; ty <= maxTy; ty++) {
        for (let tx = minTx; tx <= maxTx; tx++) {
            const px = Math.round(tx * TILE_SIZE - originX);
            const py = Math.round(ty * TILE_SIZE - originY);
            const url = getTileUrl(layerId || 'PLAN.IGN', zTile, tx, ty, apiKeys);
            tileUrls.push(url);
            tilesSvg += `    <image href="${url}" x="${px}" y="${py}" width="${TILE_SIZE}" height="${TILE_SIZE}" preserveAspectRatio="none" />\n`;
        }
    }

    // Tracé de la route
    let routeSvg = '';
    if (showRoute !== false && latLngs.length >= 2) {
        const pts = latLngs.map(p => {
            const pos = latLngToWorldPixel(p[0], p[1], zProj);
            return `${Math.round(pos.x - originX)},${Math.round(pos.y - originY)}`;
        }).join(' ');
        routeSvg = `    <polyline points="${pts}" fill="none" stroke="#2563eb" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.95" />\n`;
    }

    // Points de départ (vert) et d'arrivée (rouge)
    let endpointsSvg = '';
    if (showEndpoints !== false && latLngs.length > 0) {
        const pStart = latLngToWorldPixel(latLngs[0][0], latLngs[0][1], zProj);
        const pEnd = latLngToWorldPixel(latLngs[latLngs.length - 1][0], latLngs[latLngs.length - 1][1], zProj);
        endpointsSvg += `    <circle cx="${Math.round(pStart.x - originX)}" cy="${Math.round(pStart.y - originY)}" r="6" fill="#22c55e" stroke="#ffffff" stroke-width="2" />\n`;
        endpointsSvg += `    <circle cx="${Math.round(pEnd.x - originX)}" cy="${Math.round(pEnd.y - originY)}" r="6" fill="#ef4444" stroke="#ffffff" stroke-width="2" />\n`;
    }

    // Annotations
    let annotationsSvg = '';
    if (showAnnotations !== false) {
        if (areaAnnotations) {
            for (const area of areaAnnotations) {
                if (!area.coords || area.coords.length < 3) continue;
                const pts = area.coords.map((c: any) => {
                    const pos = latLngToWorldPixel(c[0], c[1], zProj);
                    return `${Math.round(pos.x - originX)},${Math.round(pos.y - originY)}`;
                }).join(' ');
                annotationsSvg += `    <polygon points="${pts}" fill="${area.color || '#3b82f6'}" fill-opacity="${area.fillOpacity ?? 0.25}" stroke="${area.color || '#3b82f6'}" stroke-width="2" />\n`;
            }
        }
        if (pointAnnotations) {
            for (const pt of pointAnnotations) {
                if (!pt.coords) continue;
                const pos = latLngToWorldPixel(pt.coords[0], pt.coords[1], zProj);
                const x = Math.round(pos.x - originX);
                const y = Math.round(pos.y - originY);
                if (x >= -20 && x <= W + 20 && y >= -20 && y <= H + 20) {
                    annotationsSvg += `    <circle cx="${x}" cy="${y}" r="5.5" fill="${pt.color || '#f59e0b'}" stroke="#ffffff" stroke-width="1.5" />\n`;
                    if (pt.title) {
                        annotationsSvg += `    <text x="${x}" y="${y - 8}" font-family="sans-serif" font-size="9px" font-weight="bold" fill="#0f172a" text-anchor="middle" stroke="#ffffff" stroke-width="2.5" paint-order="stroke fill">${pt.title}</text>\n`;
                    }
                }
            }
        }
    }

    // ─── Échelle réelle et barre métrique dynamique ─────────────────────────
    const latRad = (center[0] * Math.PI) / 180;
    const mpp = (156543.03392 * Math.cos(latRad)) / Math.pow(2, zProj);

    const scaleDenominator = mpp * (96 / 0.0254);
    const roundedScale = Math.round(scaleDenominator / 1000) * 1000;
    const formattedScale = `1:${roundedScale.toLocaleString('fr-FR')}`;

    const distanceCandidates = [50, 100, 200, 250, 500, 1000, 2000, 5000, 10000];
    let barDistanceM = 500;
    for (const cand of distanceCandidates) {
        const px = cand / mpp;
        if (px >= 60 && px <= 140) {
            barDistanceM = cand;
            break;
        }
    }
    const barWidthPx = Math.round(barDistanceM / mpp);
    const halfBarWidthPx = Math.round(barWidthPx / 2);
    const barLabel = barDistanceM >= 1000 ? `${barDistanceM / 1000} km` : `${barDistanceM} m`;

    const scaleBarSvg = `
    <g transform="translate(10, ${H - 24})">
        <rect x="0" y="0" width="${barWidthPx + 16}" height="18" fill="rgba(255,255,255,0.85)" stroke="#1e293b" stroke-width="0.75" />
        <rect x="8" y="5" width="${halfBarWidthPx}" height="3.5" fill="#0f172a" />
        <rect x="${8 + halfBarWidthPx}" y="5" width="${barWidthPx - halfBarWidthPx}" height="3.5" fill="#ffffff" stroke="#0f172a" stroke-width="0.5" />
        <text x="${8 + barWidthPx / 2}" y="15" font-family="monospace" font-size="7.5px" font-weight="bold" fill="#0f172a" text-anchor="middle">${barLabel}</text>
    </g>
    <g transform="translate(${W - 100}, ${H - 12})">
        <rect x="-4" y="-8" width="100" height="12" fill="rgba(255,255,255,0.75)" />
        <text x="46" y="1" font-family="monospace" font-size="6.5px" fill="#475569" text-anchor="middle">IGN &bull; ${formattedScale}</text>
    </g>`;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="display: block; width: 100%; max-width: ${W}px; height: auto; border: 1.5px solid #0f172a; background: #e2e8f0; overflow: hidden; margin: 0 auto;">
${tilesSvg}${annotationsSvg}${routeSvg}${endpointsSvg}${scaleBarSvg}
</svg>`;

    return { svg, formattedScale, tileUrls };
}

/**
 * Télécharge les tuiles et les intègre en base64 dans le SVG.
 * Retourne un SVG autonome sans dépendances externes.
 */
export async function inlineMapTilesInSvg(svg: string, tileUrls: string[]): Promise<string> {
    if (!tileUrls.length) return svg;

    const uniqueUrls = Array.from(new Set(tileUrls));
    const cache = new Map<string, string>();

    await Promise.all(uniqueUrls.map(async (url) => {
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const res = await fetch(url);
                if (res.ok) {
                    const buffer = await res.arrayBuffer();
                    const bytes = new Uint8Array(buffer);
                    let binary = '';
                    for (let i = 0; i < bytes.byteLength; i++) {
                        binary += String.fromCharCode(bytes[i]);
                    }
                    const contentType = res.headers.get('content-type') || 'image/png';
                    const b64 = `data:${contentType};base64,${btoa(binary)}`;
                    cache.set(url, b64);
                    return;
                }
            } catch {
                // Retry once
            }
        }
    }));

    let inlinedSvg = svg;
    for (const [url, b64] of cache.entries()) {
        inlinedSvg = inlinedSvg.split(url).join(b64);
    }
    return inlinedSvg;
}

/**
 * Génère un SVG de carte complet et autonome (tuiles en base64) pour un map_snippet.
 * À utiliser lors de la sauvegarde du document pour pré-rendre les cartes.
 */
export async function generateSelfContainedMapSvg(params: {
    latLngs: [number, number][];
    center: [number, number];
    zoom: number;
    width: number;
    height: number;
    layerId?: string;
    scaleName?: string;
    showRoute?: boolean;
    showEndpoints?: boolean;
    showAnnotations?: boolean;
    pointAnnotations?: any[];
    areaAnnotations?: any[];
    apiKeys?: { ign?: string; mapy?: string };
}): Promise<{ svg: string; formattedScale: string }> {
    const { svg, formattedScale, tileUrls } = generateStaticMapSvg(params);
    const inlinedSvg = await inlineMapTilesInSvg(svg, tileUrls);
    return { svg: inlinedSvg, formattedScale };
}