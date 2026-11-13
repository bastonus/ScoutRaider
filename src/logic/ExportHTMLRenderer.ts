/**
 * ExportHTMLRenderer.ts — Minimalist, factual, strictly contained print renderer.
 * 
 * Strict overflow prevention:
 * - max-width: 100%, width: 100%, box-sizing: border-box on all elements
 * - table-layout: fixed, word-break: break-word, overflow-wrap: anywhere
 * - svg width="100%" height="auto" and overflow hidden
 * - No horizontal spillover under any circumstance
 */

import type { CarnetStep, ThemeData } from './types';
import { ModuleLogic } from './ModuleLogic';
import { calculateSmartMapDimensions } from '../components/textual/MiniMap';

import { calculatePolygonArea, formatArea } from './GeoUtils';
import type { PointAnnotation, AreaAnnotation, Itinerary } from './types';
import type { PaginationPlan } from './MapPagination';

export interface ExportRenderOptions {
    title: string;
    subtitle: string;
    date: string;
    themeTitle: string;
    isSolution: boolean;
    includeGeneralMap: boolean;
    includeElevationProfile?: boolean;
    elevationSvg?: string;
    elevationStats?: { ascend_m: number; descend_m: number; min_alt_m: number; max_alt_m: number; duration_min: number };
    includeMapPagination?: boolean;
    mapPaginationPlan?: PaginationPlan;
    mapPaginationSvg?: string;
    includeAnnexes: boolean;
    vigenereKey: string;
    pointAnnotations?: PointAnnotation[];
    areaAnnotations?: AreaAnnotation[];
    itineraries?: Itinerary[];
    paperSize?: 'A4' | 'A5' | 'A3' | 'Letter';
}

function buildCSS(fontsBase64: Record<string, string>, paperSize: string = 'A4'): string {
    let fontFaces = '';
    if (fontsBase64.morse) {
        fontFaces += `@font-face { font-family: 'Morse'; src: url('data:font/truetype;base64,${fontsBase64.morse}') format('truetype'); }\n`;
    }
    if (fontsBase64.templier) {
        fontFaces += `@font-face { font-family: 'TemplarsCipherPlus'; src: url('data:font/truetype;base64,${fontsBase64.templier}') format('truetype'); }\n`;
    }
    if (fontsBase64.maritime) {
        fontFaces += `@font-face { font-family: 'Maritime'; src: url('data:font/truetype;base64,${fontsBase64.maritime}') format('truetype'); }\n`;
    }

    return `
${fontFaces}

*, *:before, *:after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

html, body {
    width: 100%;
    max-width: 100%;
    overflow-x: hidden;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: #ffffff;
    color: #111111;
    padding: 16px;
    line-height: 1.4;
    font-size: 10.5pt;
    word-break: break-word;
    overflow-wrap: anywhere;
}

@page {
    size: ${paperSize} portrait;
    margin: 14mm 14mm 14mm 14mm;

    @top-left {
        content: string(raidtitle);
        font-family: inherit;
        font-size: 8pt;
        font-weight: 600;
        color: #111111;
        border-bottom: 1pt solid #111111;
        padding-bottom: 2mm;
    }

    @top-right {
        content: string(versiontitle);
        font-family: inherit;
        font-size: 8pt;
        font-weight: 600;
        color: #555555;
        border-bottom: 1pt solid #111111;
        padding-bottom: 2mm;
    }

    @bottom-center {
        content: counter(page) " / " counter(pages);
        font-family: inherit;
        font-size: 8pt;
        color: #666666;
        border-top: 0.5pt solid #cccccc;
        padding-top: 2mm;
    }
}

.raid-title-target {
    string-set: raidtitle content();
    display: none;
}

.version-title-target {
    string-set: versiontitle content();
    display: none;
}

.page-header {
    width: 100%;
    border-bottom: 2pt solid #111111;
    padding-bottom: 10px;
    margin-bottom: 16px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
}

h1 {
    font-size: 16pt;
    font-weight: 700;
    color: #111111;
    letter-spacing: -0.02em;
    margin: 0;
    word-break: break-word;
}

.subtitle {
    font-size: 8.5pt;
    color: #555555;
    margin-top: 2px;
    font-family: monospace;
}

.step {
    width: 100%;
    max-width: 100%;
    border-bottom: 1pt solid #e5e5e5;
    padding: 8px 0;
    break-inside: avoid;
    page-break-inside: avoid;
    overflow: hidden;
}

.step:last-child {
    border-bottom: none;
}

.step-meta {
    width: 100%;
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 4px;
}

.step-num {
    font-size: 9.5pt;
    font-weight: 700;
    color: #111111;
    font-family: monospace;
    flex-shrink: 0;
}

.step-leg {
    font-size: 9.5pt;
    font-weight: 600;
    color: #111111;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.step-metrics {
    font-size: 8.5pt;
    color: #666666;
    margin-left: auto;
    font-family: monospace;
    flex-shrink: 0;
    white-space: nowrap;
}

.step-content {
    width: 100%;
    font-size: 10.5pt;
    color: #111111;
    line-height: 1.4;
    word-break: break-word;
    overflow-wrap: anywhere;
}

.encoded {
    width: 100%;
    font-size: 11pt;
    color: #000000;
    word-break: break-all;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
}

.solution-clair {
    width: 100%;
    font-size: 9pt;
    color: #555555;
    margin-top: 3px;
    border-left: 2pt solid #111111;
    padding-left: 6px;
    font-style: italic;
    word-break: break-word;
}

/* Module fonts */
.font-morse {
    font-family: 'Morse', 'Courier New', monospace;
    font-size: 15pt;
    line-height: 1.2;
    letter-spacing: 1px;
}

.font-templier {
    font-family: 'TemplarsCipherPlus', 'Courier New', monospace;
    font-size: 15pt;
    line-height: 1.2;
}

.font-maritime {
    font-family: 'Maritime', monospace;
    font-size: 16pt;
    line-height: 1.2;
}

.font-mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

/* Map cards */
.step-map-card {
    width: 100%;
    max-width: 100%;
    margin: 6px 0;
    border: 1pt solid #111111;
    padding: 6px;
    background: #ffffff;
    overflow: hidden;
}

.map-placeholder {
    width: 100% !important;
    max-width: 100% !important;
    min-height: 150px;
    background: #f5f5f5;
    border: 0.5pt solid #cccccc;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #666666;
    font-size: 8.5pt;
    font-family: monospace;
    margin-top: 4px;
    overflow: hidden;
}

/* Strict Tables */
table {
    width: 100% !important;
    max-width: 100% !important;
    table-layout: fixed;
    border-collapse: collapse;
    margin: 8px 0;
    font-size: 8.5pt;
}

th, td {
    border: 0.5pt solid #cccccc;
    padding: 4px 6px;
    text-align: left;
    word-break: break-word;
    overflow-wrap: anywhere;
    vertical-align: top;
}

th {
    background: #f5f5f5;
    font-weight: 600;
    color: #111111;
}

/* SVGs */
svg {
    max-width: 100% !important;
    height: auto !important;
}

/* Annexes */
.annexe-section {
    width: 100%;
    max-width: 100%;
    margin-top: 20px;
    border-top: 1.5pt solid #111111;
    padding-top: 10px;
    break-before: page;
    page-break-before: always;
    break-inside: avoid;
    overflow: hidden;
}

.annexe-title {
    font-size: 10.5pt;
    font-weight: 700;
    text-transform: uppercase;
    margin-bottom: 6px;
    color: #111111;
    letter-spacing: 0.04em;
}

.morse-grid, .nato-grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 3px;
    width: 100%;
}

.morse-cell, .nato-cell {
    border: 0.5pt solid #dddddd;
    padding: 2px 4px;
    text-align: center;
    font-size: 8pt;
    overflow: hidden;
}

.mc, .nc {
    font-weight: 700;
    font-family: monospace;
}
`;
}

function getModuleFontClass(moduleId: string): string {
    const map: Record<string, string> = {
        morse: 'font-morse',
        templier: 'font-templier',
        maritime: 'font-maritime',
        vigenere: 'font-mono',
        polybe: 'font-mono',
    };
    return map[moduleId] || '';
}

/**
 * Projette une coordonnée (lat, lng) en pixels monde Web Mercator (EPSG:3857) au niveau de zoom donné.
 */
function latLngToWorldPixel(lat: number, lng: number, zoom: number): { x: number; y: number } {
    const latRad = (lat * Math.PI) / 180;
    const n = Math.pow(2, zoom);
    const x = ((lng + 180) / 360) * n * 256;
    const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n * 256;
    return { x, y };
}

/**
 * Génère le SVG autonome de la carte avec ses tuiles réelles, son tracé vectoriel,
 * ses points de départ et d'arrivée, ses annotations et son échelle dynamique au sol.
 */
function generateStaticMapSvg(params: {
    latLngs: [number, number][];
    center: [number, number]; // [lat, lng]
    zoom: number;
    width: number;
    height: number;
    layerId?: string;
    showRoute?: boolean;
    showEndpoints?: boolean;
    showAnnotations?: boolean;
    pointAnnotations?: any[];
    areaAnnotations?: any[];
}): { svg: string; formattedScale: string } {
    const { latLngs, center, zoom, width, height, layerId, showRoute, showEndpoints, showAnnotations, pointAnnotations, areaAnnotations } = params;

    const W = Math.round(width);
    const H = Math.round(height);

    // zProj : zoom fractionnaire utilisé pour toutes les projections pixel — donne l'échelle EXACTE demandée.
    // zTile : entier strict pour les URLs WMTS/OSM (l'API rejette tout non-entier).
    const zProj = Math.min(18, Math.max(8, zoom));
    const zTile = Math.min(18, Math.max(8, Math.round(zoom)));

    // Pixel monde du centre (projection à l'échelle fractionnaire exacte)
    const cPx = latLngToWorldPixel(center[0], center[1], zProj);
    const originX = cPx.x - W / 2;
    const originY = cPx.y - H / 2;

    // Tuiles requises : positions à l'aide du zoom entier pour les indices de tuile,
    // mais positions pixel en cohérence avec zProj
    const cPxTile = latLngToWorldPixel(center[0], center[1], zTile);
    const originXTile = cPxTile.x - W / 2;
    const originYTile = cPxTile.y - H / 2;
    const minTx = Math.floor(originXTile / 256);
    const maxTx = Math.floor((originXTile + W) / 256);
    const minTy = Math.floor(originYTile / 256);
    const maxTy = Math.floor((originYTile + H) / 256);

    let tilesSvg = '';
    for (let ty = minTy; ty <= maxTy; ty++) {
        for (let tx = minTx; tx <= maxTx; tx++) {
            const px = Math.round(tx * 256 - originX);
            const py = Math.round(ty * 256 - originY);
            let url = '';
            if (layerId === 'OSM') {
                url = `https://tile.openstreetmap.org/${z}/${tx}/${ty}.png`;
            } else if (layerId === 'CYCLOSM') {
                url = `https://tile-cyclosm.openstreetmap.fr/cyclosm/${z}/${tx}/${ty}.png`;
            } else if (layerId === 'SAT.IGN') {
                url = `https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX=${z}&TILEROW=${ty}&TILECOL=${tx}`;
            } else {
                // Défaut Plan IGN v2
                url = `https://data.geopf.fr/wmts?SERVICE=WMTS&VERSION=1.0.0&REQUEST=GetTile&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX=${z}&TILEROW=${ty}&TILECOL=${tx}`;
            }
            tilesSvg += `    <image href="${url}" x="${px}" y="${py}" width="256" height="256" preserveAspectRatio="none" />
`;
        }
    }

    // Tracé de l'étape
    let routeSvg = '';
    if (showRoute !== false && latLngs.length >= 2) {
        const pts = latLngs.map(p => {
            const pos = latLngToWorldPixel(p[0], p[1], z);
            return `${Math.round(pos.x - originX)},${Math.round(pos.y - originY)}`;
        }).join(' ');
        routeSvg = `    <polyline points="${pts}" fill="none" stroke="#2563eb" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.95" />
`;
    }

    // Points de départ (vert) et d'arrivée (rouge)
    let endpointsSvg = '';
    if (showEndpoints !== false && latLngs.length > 0) {
        const pStart = latLngToWorldPixel(latLngs[0][0], latLngs[0][1], zProj);
        const pEnd = latLngToWorldPixel(latLngs[latLngs.length - 1][0], latLngs[latLngs.length - 1][1], zProj);
        endpointsSvg += `    <circle cx="${Math.round(pStart.x - originX)}" cy="${Math.round(pStart.y - originY)}" r="6" fill="#22c55e" stroke="#ffffff" stroke-width="2" />
`;
        endpointsSvg += `    <circle cx="${Math.round(pEnd.x - originX)}" cy="${Math.round(pEnd.y - originY)}" r="6" fill="#ef4444" stroke="#ffffff" stroke-width="2" />
`;
    }

    // Annotations (aires et repères)
    let annotationsSvg = '';
    if (showAnnotations !== false) {
        if (areaAnnotations) {
            for (const area of areaAnnotations) {
                if (!area.coords || area.coords.length < 3) continue;
                const pts = area.coords.map((c: any) => {
                    const pos = latLngToWorldPixel(c[0], c[1], zProj);
                    return `${Math.round(pos.x - originX)},${Math.round(pos.y - originY)}`;
                }).join(' ');
                annotationsSvg += `    <polygon points="${pts}" fill="${area.color || '#3b82f6'}" fill-opacity="${area.fillOpacity ?? 0.25}" stroke="${area.color || '#3b82f6'}" stroke-width="2" />
`;
            }
        }
        if (pointAnnotations) {
            for (const pt of pointAnnotations) {
                if (!pt.coords) continue;
                const pos = latLngToWorldPixel(pt.coords[0], pt.coords[1], zProj);
                const x = Math.round(pos.x - originX);
                const y = Math.round(pos.y - originY);
                if (x >= -20 && x <= W + 20 && y >= -20 && y <= H + 20) {
                    annotationsSvg += `    <circle cx="${x}" cy="${y}" r="5.5" fill="${pt.color || '#f59e0b'}" stroke="#ffffff" stroke-width="1.5" />
`;
                    if (pt.title) {
                        annotationsSvg += `    <text x="${x}" y="${y - 8}" font-family="sans-serif" font-size="9px" font-weight="bold" fill="#0f172a" text-anchor="middle" stroke="#ffffff" stroke-width="2.5" paint-order="stroke fill">${pt.title}</text>
`;
                    }
                }
            }
        }
    }

    // ─── Échelle réelle et barre métrique dynamique ─────────────────────────
    // Résolution au sol (mètres par pixel) EPSG:3857
    const latRad = (center[0] * Math.PI) / 180;
    const mpp = (156543.03392 * Math.cos(latRad)) / Math.pow(2, zProj);

    // Dénominateur de l'échelle réelle à 96 DPI standard (1 px = 0.0254 / 96 m)
    const scaleDenominator = mpp * (96 / 0.0254);
    const roundedScale = Math.round(scaleDenominator / 1000) * 1000;
    const formattedScale = `1:${roundedScale.toLocaleString('fr-FR')}`;

    // Choix automatique d'une graduation métrique esthétique (entre 60px et 140px)
    const distanceCandidates = [50, 100, 200, 250, 500, 1000, 2000, 5000, 10000];
    let barDistanceM = 500;
    for (const cand of distanceCandidates) {
        const px = cand / mpp;
        if (px >= 60 && px <= 140) {
            barDistanceM = cand;
            break;
        }
    }
    // Largeur de la barre au pixel près
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

    return { svg, formattedScale };
}

function renderStep(step: CarnetStep, stepNum: number, isSolution: boolean, exportOptions?: ExportRenderOptions): string {
    const fromTo = step.fromLabel && step.toLabel
        ? `${step.fromLabel} → ${step.toLabel}`
        : step.fromLabel || '';

    let visualContent = '';
    if (step.moduleId === 'gilwell' && step.gilwellSvg) {
        visualContent = `<div style="margin: 4px 0; width: 100%; max-width: 100%; overflow: hidden;">${step.gilwellSvg}</div>`;
    } else if (['carte_ign', 'carte_simple', 'drapeaux'].includes(step.moduleId)) {
        const latLngs = (step.coords || []).map((c: any) => [c[1], c[0]] as [number, number]);
        const midPoint = latLngs.length > 0 ? latLngs[Math.floor(latLngs.length / 2)] : [48.85, 2.35] as [number, number];
        const center = step.mapPersist?.center || (step.mapCenter ? [step.mapCenter[0], step.mapCenter[1]] as [number, number] : midPoint);
        const smartDims = calculateSmartMapDimensions(latLngs, 680, step.mapPersist?.scaleName || '1:25000');
        const h = (step.mapPersist?.height && step.mapPersist.height !== 340) ? step.mapPersist.height : smartDims.height;
        const w = step.mapPersist?.width ? step.mapPersist.width : smartDims.width;

        // ─── Zoom pour l'export ───────────────────────────────────────────────
        // Constante EPSG:3857 @ 96 DPI (identique à MiniMap.tsx)
        const SCALE_CONSTANT_EXPORT = 591657550.5;
        const centerLatRad = (center[0] * Math.PI) / 180;
        const cosCenter = Math.cos(centerLatRad);

        // 1. Zoom cible depuis l'échelle demandée (fractionnaire exact → préserve l'échelle au pixel près)
        const scaleDenomMap: Record<string, number> = {
            '1:10000': 10000, '1:25000': 25000, '1:50000': 50000, '1:100000': 100000,
        };
        const scaleNameKey = step.mapPersist?.scaleName || '1:25000';
        const scaleDenom = scaleDenomMap[scaleNameKey] || 25000;
        const scaleZoom = Math.log2((SCALE_CONSTANT_EXPORT * cosCenter) / scaleDenom);

        // 2. Zoom anti-rognage minimal (garantit que tout le tracé rentre dans le cadre)
        let antiClipZoom = scaleZoom; // par défaut on ne clippe pas
        if (latLngs.length >= 2) {
            let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
            for (const p of latLngs) {
                if (p[0] < minLat) minLat = p[0];
                if (p[0] > maxLat) maxLat = p[0];
                if (p[1] < minLng) minLng = p[1];
                if (p[1] > maxLng) maxLng = p[1];
            }
            const spanXMeters = (maxLng - minLng) * 111320 * cosCenter;
            const spanYMeters = (maxLat - minLat) * 110540;
            const reqMppX = spanXMeters / (w * 0.78);
            const reqMppY = spanYMeters / (h * 0.78);
            const maxReqMpp = Math.max(reqMppX, reqMppY);
            if (maxReqMpp > 0) {
                antiClipZoom = Math.log2((156543.03392 * cosCenter) / maxReqMpp);
            }
        }

        // 3. Zoom effectif :
        //    - Si l'utilisateur a verrouillé manuellement (cadenas), on respecte son zoom exact.
        //    - Sinon, on prend le zoom de l'échelle choisie, mais pas plus zoomé que l'anti-rognage.
        let effectiveZoom: number;
        if (step.mapPersist?.zoom !== undefined && step.mapPersist.isLocked) {
            // Carte verrouillée : zoom utilisateur exact (toujours entier pour les tuiles WMTS,
            // mais ici on passe un float — generateStaticMapSvg gère zProj/zTile séparément)
            effectiveZoom = step.mapPersist.zoom;
        } else if (step.mapPersist?.scaleName && scaleNameKey !== 'auto') {
            // Échelle explicitement choisie : on respecte scaleZoom, avec plancher anti-rognage
            effectiveZoom = Math.min(scaleZoom, antiClipZoom + 0.5); // +0.5 de tolérance
        } else if (step.mapPersist?.zoom !== undefined) {
            // Zoom persisté sans échelle explicite
            effectiveZoom = Math.min(step.mapPersist.zoom, antiClipZoom + 0.5);
        } else {
            // Aucune préférence : zoom anti-rognage (vue d'ensemble)
            effectiveZoom = Math.min(antiClipZoom, scaleZoom);
        }
        // Bornes de sécurité
        effectiveZoom = Math.min(18, Math.max(8, effectiveZoom));

        const { svg: mapSvg, formattedScale } = generateStaticMapSvg({
            latLngs,
            center,
            zoom: effectiveZoom,
            width: w,
            height: h,
            layerId: step.mapPersist?.layerId,
            showRoute: step.mapPersist?.showRoute,
            showEndpoints: step.mapPersist?.showEndpoints,
            showAnnotations: step.mapPersist?.showAnnotations,
            pointAnnotations: exportOptions?.pointAnnotations,
            areaAnnotations: exportOptions?.areaAnnotations,
        });

        const rawLabel = (step.fromLabel || '').trim();
        const fromLabelClean = (rawLabel && rawLabel.toLowerCase() !== 'none') ? rawLabel : '';

        visualContent = `
        <div class="step-map-card">
            <div style="font-size: 8pt; font-family: monospace; margin-bottom: 4px; display: flex; justify-content: space-between; color: #334155;">
                <span>EXTRAIT CARTOGRAPHIQUE (${formattedScale}${fromLabelClean ? ' — ' + fromLabelClean : ''})</span>
                <span>Cap ${step.azimuth || 0}° &bull; ${step.distanceM || 0}m</span>
            </div>
            <div style="width: 100%; max-width: 100%; overflow: hidden; display: flex; justify-content: center; margin: 4px 0;">
                ${mapSvg}
            </div>
        </div>`;
    }

    const fontClass = getModuleFontClass(step.moduleId);
    const displayText = isSolution ? step.solutionText : step.encodedText;
    const isEncoded = !isSolution && step.moduleId !== 'texte_clair' && displayText !== step.solutionText;

    let textContent = '';
    if (!['carte_ign', 'carte_simple', 'gilwell'].includes(step.moduleId) && displayText) {
        if (isEncoded) {
            textContent += `<div class="encoded ${fontClass}">${displayText.replace(/\n/g, '<br>')}</div>`;
            if (isSolution && step.solutionText) {
                textContent += `<div class="solution-clair">${step.solutionText}</div>`;
            }
        } else {
            textContent += `<div class="step-content">${displayText.replace(/\n/g, '<br>')}</div>`;
        }
    }

    return `
  <div class="step">
    <div class="step-meta">
      <span class="step-num">#${stepNum}</span>
      ${fromTo ? `<span class="step-leg">${fromTo}</span>` : ''}
      <span class="step-metrics">${step.distanceM ? `${step.distanceM}m` : ''} ${step.azimuth ? `(${step.azimuth}°)` : ''}</span>
    </div>
    ${visualContent}
    ${textContent}
  </div>`;
}

function renderMorseAnnexe(): string {
    const table = ModuleLogic.getMorseTable();
    let html = '<div class="annexe-section"><div class="annexe-title">Table Morse</div><div class="morse-grid">';
    for (const [char, code] of Object.entries(table)) {
        html += `<div class="morse-cell"><span class="mc">${char.toUpperCase()}</span> : <code>${code}</code></div>`;
    }
    html += '</div></div>';
    return html;
}

function renderPolybeAnnexe(): string {
    const grid = ModuleLogic.getPolybeGrid();
    let html = '<div class="annexe-section"><div class="annexe-title">Carré de Polybe</div>';
    html += '<table><tr><th style="width: 14%;"></th>';
    for (let c = 1; c <= 6; c++) html += `<th style="width: 14%; text-align: center;">${c}</th>`;
    html += '</tr>';
    for (let r = 0; r < 6; r++) {
        html += `<tr><th style="text-align: center;">${r + 1}</th>`;
        for (let c = 0; c < 6; c++) {
            html += `<td style="text-align: center;"><strong>${grid[r][c].char}</strong> <span style="color:#666; font-size:7pt;">${grid[r][c].coord}</span></td>`;
        }
        html += '</tr>';
    }
    html += '</table></div>';
    return html;
}

function renderVigenereAnnexe(key: string): string {
    const { alphabet, table } = ModuleLogic.getVigenereTable(key);
    let html = `<div class="annexe-section"><div class="annexe-title">Table de Vigenère (Clé : ${key})</div>`;
    html += '<table style="font-size: 7.5pt;"><tr><th style="width: 3.5%;"></th>';
    for (const c of alphabet) html += `<th style="width: 3.7%; text-align: center; padding: 2px 1px;">${c}</th>`;
    html += '</tr>';
    for (let i = 0; i < table.length; i++) {
        html += `<tr><th style="text-align: center; padding: 2px 1px;">${alphabet[i]}</th>`;
        for (const c of table[i]) html += `<td style="text-align: center; padding: 2px 1px;">${c}</td>`;
        html += '</tr>';
    }
    html += '</table></div>';
    return html;
}

function renderMaritimeAnnexe(): string {
    const nato = ModuleLogic.getNATOAlphabet();
    let html = '<div class="annexe-section"><div class="annexe-title">Code Maritime & Radio (OTAN)</div><div class="nato-grid">';
    for (const [char, word] of Object.entries(nato)) {
        html += `<div class="nato-cell"><span class="nc">${char.toUpperCase()}</span>: ${word}</div>`;
    }
    html += '</div></div>';
    return html;
}

function renderAnnotationsSection(
    points: PointAnnotation[] = [],
    areas: AreaAnnotation[] = []
): string {
    const activePoints = points.filter(p => p.visible !== false);
    const activeAreas = areas.filter(a => a.visible !== false);

    if (activePoints.length === 0 && activeAreas.length === 0) return '';

    let html = `<div class="annexe-section"><div class="annexe-title">Repères & Périmètres Délimités</div>`;

    if (activePoints.length > 0) {
        html += `
        <table>
          <thead>
            <tr>
              <th style="width: 25%;">Repère</th>
              <th style="width: 30%;">Coordonnées GPS</th>
              <th style="width: 45%;">Consignes</th>
            </tr>
          </thead>
          <tbody>`;
        for (const pt of activePoints) {
            html += `
            <tr>
              <td><strong>${pt.title}</strong></td>
              <td style="font-family: monospace;">${pt.coords[0].toFixed(5)}, ${pt.coords[1].toFixed(5)}</td>
              <td>${pt.text || '—'}</td>
            </tr>`;
        }
        html += `</tbody></table>`;
    }

    if (activeAreas.length > 0) {
        html += `
        <table>
          <thead>
            <tr>
              <th style="width: 25%;">Zone</th>
              <th style="width: 25%;">Superficie</th>
              <th style="width: 50%;">Consignes</th>
            </tr>
          </thead>
          <tbody>`;
        for (const a of activeAreas) {
            const surface = a.formatted_area || formatArea(calculatePolygonArea(a.coords));
            html += `
            <tr>
              <td><strong>${a.title}</strong></td>
              <td style="font-family: monospace;">${surface}</td>
              <td>${a.text || '—'}</td>
            </tr>`;
        }
        html += `</tbody></table>`;
    }

    html += `</div>`;
    return html;
}

export class ExportHTMLRenderer {
    /**
     * Pré-télécharge les tuiles distantes trouvées dans le HTML et les convertit
     * en data:image/png;base64,... pour que WeasyPrint ne souffre d'aucune tuile manquante.
     */
    static async inlineMapTiles(html: string): Promise<string> {
        const tileRegex = /<image\s+([^>]*?)href="(https:\/\/[^"]+)"([^>]*?)\/>/g;
        const matches = Array.from(html.matchAll(tileRegex));
        if (!matches.length) return html;

        const uniqueUrls = Array.from(new Set(matches.map(m => m[2])));
        const cache = new Map<string, string>();

        await Promise.all(uniqueUrls.map(async url => {
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

        let inlinedHtml = html;
        for (const [url, b64] of cache.entries()) {
            inlinedHtml = inlinedHtml.split(url).join(b64);
        }
        return inlinedHtml;
    }

    static render(
        steps: CarnetStep[],
        theme: ThemeData,
        options: ExportRenderOptions,
        fontsBase64: Record<string, string> = {}
    ): string {
        const css = buildCSS(fontsBase64, options.paperSize || 'A4');
        const roleLabel = options.isSolution ? 'SOLUTION' : 'PARTICIPANT';

        let html = `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${options.title || 'Carnet de route'} — ${roleLabel}</title>
    <style>${css}</style>
</head>
<body>
  <span class="raid-title-target">${options.title || 'CARNET DE ROUTE'}</span>
  <span class="version-title-target">${roleLabel}</span>

  <div class="page-header">
    <div>
      <h1>${options.title || 'CARNET DE ROUTE'}</h1>
      <div class="subtitle">${steps.length} étapes &bull; ${roleLabel} &bull; ${new Date().toLocaleDateString('fr-FR')}</div>
    </div>
  </div>
`;

        if (options.includeElevationProfile && options.elevationSvg) {
            const stats = options.elevationStats;
            html += `
  <div style="width: 100%; margin-bottom: 16px; border-bottom: 1pt solid #111111; padding-bottom: 10px; page-break-inside: avoid; overflow: hidden;">
    <div style="font-size: 8.5pt; font-family: monospace; font-weight: 700; margin-bottom: 4px;">
        PROFIL ALTIMÉTRIQUE ${stats ? `&bull; D+ +${stats.ascend_m}m &bull; D- -${stats.descend_m}m &bull; ${stats.min_alt_m}m / ${stats.max_alt_m}m` : ''}
    </div>
    <div style="width: 100%; max-width: 100%; overflow: hidden;">${options.elevationSvg}</div>
  </div>`;
        }

        let stepNum = 1;
        for (const step of steps) {
            html += renderStep(step, stepNum, options.isSolution, options);
            stepNum++;
        }

        html += renderAnnotationsSection(options.pointAnnotations, options.areaAnnotations);

        if (options.includeAnnexes) {
            const usedModules = new Set(steps.map(s => s.moduleId));
            if (usedModules.has('morse')) html += renderMorseAnnexe();
            if (usedModules.has('polybe')) html += renderPolybeAnnexe();
            if (usedModules.has('vigenere')) html += renderVigenereAnnexe(options.vigenereKey);
            if (usedModules.has('maritime')) html += renderMaritimeAnnexe();
        }

        html += `
</body>
</html>`;
        return html;
    }
}
