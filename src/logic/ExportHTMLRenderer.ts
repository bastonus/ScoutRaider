/**
 * ExportHTMLRenderer.ts — Premium HTML template engine for export.
 * 
 * Generates a self-contained A4 HTML document (inline CSS, @page rules for WeasyPrint,
 * embedded fonts via Google Fonts, SVG diagrams inline).
 * 
 * Inspired by legacy/utils/export_html.py + export_content.py.
 * This single HTML serves as the universal source for all export formats:
 *   - Direct HTML save
 *   - PDF via WeasyPrint (python -m weasyprint)
 *   - PDF via Electron printToPDF (fallback)
 */

import type { CarnetStep, ThemeData } from './types';
import { ModuleLogic } from './ModuleLogic';
import { ModuleRegistry } from './ModuleRegistry';

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── CSS ──────────────────────────────────────────────────────────────────────

function buildCSS(accent: string, isSolution: boolean, fontsBase64: Record<string, string>, paperSize: string = 'A4'): string {
    const accentDark = isSolution ? '#8b2500' : '#1a3a5c';

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
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&family=Courier+Prime:ital,wght@0,400;0,700;1,400&family=Kalam:wght@400;700&display=swap');

${fontFaces}

:root {
    --accent: ${accent};
    --accent-dark: ${accentDark};
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
    font-family: 'Segoe UI', Tahoma, sans-serif;
    background: #f0f4f8;
    color: #1e293b;
    padding: 32px 16px;
    line-height: 1.6;
}

@page {
    size: ${paperSize} portrait;
    margin: 18mm 14mm 20mm 14mm;

    @top-left {
        content: "SCOUTRAIDER SUITE";
        font-family: 'Segoe UI', Tahoma, sans-serif;
        font-size: 7.5pt;
        letter-spacing: 1px;
        color: #64748b;
        vertical-align: bottom;
        padding-bottom: 4mm;
        border-bottom: 0.5pt solid #cbd5e1;
    }

    @top-right {
        content: string(raidtitle);
        font-family: 'Segoe UI', Tahoma, sans-serif;
        font-size: 8pt;
        font-weight: bold;
        color: #1e293b;
        vertical-align: bottom;
        padding-bottom: 4mm;
        border-bottom: 0.5pt solid #cbd5e1;
    }

    @bottom-left {
        content: string(versiontitle);
        font-family: 'Segoe UI', Tahoma, sans-serif;
        font-size: 7.5pt;
        color: #94a3b8;
        vertical-align: top;
        padding-top: 3mm;
        border-top: 0.5pt solid #e2e8f0;
    }

    @bottom-center {
        content: counter(page) " / " counter(pages);
        font-family: 'Segoe UI', Tahoma, sans-serif;
        font-size: 8pt;
        font-weight: 600;
        color: #64748b;
        vertical-align: top;
        padding-top: 3mm;
        border-top: 0.5pt solid #e2e8f0;
    }

    @bottom-right {
        content: "Toujours Prêt";
        font-family: 'Segoe UI', Tahoma, sans-serif;
        font-size: 7.5pt;
        font-style: italic;
        color: #94a3b8;
        vertical-align: top;
        padding-top: 3mm;
        border-top: 0.5pt solid #e2e8f0;
    }
}

@page:first {
    margin: 0;
    @top-left { content: none; border: none; }
    @top-right { content: none; border: none; }
    @bottom-left { content: none; border: none; }
    @bottom-center { content: none; border: none; }
    @bottom-right { content: none; border: none; }
}

.page-header {
    text-align: center;
    margin-bottom: 36px;
    border-bottom: 3px solid var(--accent);
    padding-bottom: 16px;
}

h1 {
    font-size: 24px;
    color: var(--accent);
    letter-spacing: 2px;
    text-transform: uppercase;
}

.subtitle {
    color: #64748b;
    font-size: 11px;
    margin-top: 4px;
}

.step {
    background: #fff;
    border-radius: 6px;
    box-shadow: 0 1px 4px rgba(0,0,0,.08);
    margin-bottom: 16px;
    overflow: hidden;
    break-inside: avoid;
    page-break-inside: avoid;
}

.step-body p, .step-body div, .msg, .visual-msg, .encoded {
    orphans: 3;
    widows: 3;
}

.step-header {
    background: var(--accent);
    color: #fff;
    padding: 10px 14px;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    display: flex;
    align-items: center;
    gap: 8px;
}

.step-num {
    background: rgba(255,255,255,.25);
    border-radius: 50%;
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 700;
    flex-shrink: 0;
}

.step-body {
    padding: 12px 14px;
}

.msg {
    display: flex;
    gap: 8px;
    padding: 7px 0;
    border-bottom: 1px solid #f1f5f9;
    align-items: flex-start;
}
.msg:last-child {
    border-bottom: none;
}

.msg-num {
    min-width: 20px;
    height: 20px;
    background: var(--accent);
    color: #fff;
    border-radius: 50%;
    font-size: 9px;
    font-weight: 700;
    text-align: center;
    line-height: 20px;
    flex-shrink: 0;
}

.encoded {
    font-size: 13px;
    font-weight: 600;
    color: #1e293b;
    word-break: break-all;
}

.clair-hint {
    font-size: 10px;
    color: #94a3b8;
    margin-top: 2px;
    font-style: italic;
}

.visual-msg {
    font-size: 12px;
    color: #475569;
}

.svg-container {
    text-align: center;
    margin: 12px 0;
}

.step-map-card {
    margin: 8px 0;
    border: 1pt solid #cbd5e1;
    border-radius: 4px;
    background: #f8fafc;
    overflow: hidden;
    break-inside: avoid;
    page-break-inside: avoid;
}

.step-map-header {
    background: #f1f5f9;
    border-bottom: 0.5pt solid #cbd5e1;
    padding: 6px 10px;
    font-size: 8.5pt;
    font-weight: bold;
    display: flex;
    justify-content: space-between;
}

.step-map-visual {
    padding: 10px 12px;
    border-left: 3pt solid #16a34a;
    background: #f0fdf4;
    font-size: 9pt;
    color: #1e293b;
}

.map-placeholder {
    width: 100%;
    min-height: 180px;
    background: #e2e8f0;
    border-radius: 4px;
    border: 1px solid #cbd5e1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #64748b;
    font-size: 10pt;
    margin-bottom: 6px;
}

/* ── Typography per module ── */
.font-morse {
    font-family: 'Morse', 'Courier New', monospace;
    font-size: 20px;
    line-height: 1.2;
}

.font-templier {
    font-family: 'TemplarsCipherPlus', 'Courier New', monospace;
    font-size: 20px;
    line-height: 1.2;
}

.font-maritime, .font-drapeaux {
    font-family: 'Maritime', monospace;
    font-size: 24px;
    line-height: 1.2;
}

.font-cassis, .font-avocat {
    font-family: 'Kalam', cursive;
    font-size: 15px;
}

.font-vigenere, .font-polybe {
    font-family: 'Courier Prime', monospace;
    font-size: 14px;
    letter-spacing: 1px;
}

/* ── Annexes ── */
.annexe, .annexe-section {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 14px;
    margin-top: 16px;
    break-before: page;
    page-break-before: always;
    break-inside: avoid;
    page-break-inside: avoid;
}
.annexe h3 {
    font-size: 11px;
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 10px;
}
.morse-grid, .nato-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
}
.morse-cell, .nato-cell {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    padding: 4px 7px;
    text-align: center;
    min-width: 44px;
}
.mc, .nc {
    display: block;
    font-size: 14px;
    font-weight: 700;
    color: var(--accent);
}
.ms {
    font-family: 'Courier New', monospace;
    font-size: 10px;
    color: #475569;
}
.nw {
    display: block;
    font-size: 9px;
    color: #475569;
}
.annexe-table {
    border-collapse: collapse;
    font-size: 10px;
    width: auto;
    margin: 0 auto;
}
.annexe-table th, .annexe-table td {
    border: 1px solid #e2e8f0;
    padding: 3px 5px;
    text-align: center;
}
.annexe-table th {
    background: var(--accent);
    color: #fff;
}
.vig-scroll { overflow-x: auto; }
.vig-table td { min-width: 14px; padding: 2px; font-size: 8px; }

/* ── Footer ── */
.page-footer {
    text-align: center;
    margin-top: 32px;
    color: #94a3b8;
    font-size: 10px;
    border-top: 1px solid #e2e8f0;
    padding-top: 12px;
}
`;
}

// ─── Annexe Renderers ─────────────────────────────────────────────────────────

function renderMorseAnnexe(): string {
    const table = ModuleLogic.getMorseTable();
    let html = '<div class="annexe-section"><h2 class="annexe-title">TABLE MORSE</h2><div class="morse-grid">';
    for (const [char, code] of Object.entries(table)) {
        html += `<div class="morse-cell"><span class="morse-char">${char.toUpperCase()}</span><span class="morse-code">${code}</span></div>`;
    }
    html += '</div></div>';
    return html;
}

function renderPolybeAnnexe(): string {
    const grid = ModuleLogic.getPolybeGrid();
    let html = '<div class="annexe-section"><h2 class="annexe-title">CARRÉ DE POLYBE</h2>';
    html += '<table class="annexe-table"><tr><th></th>';
    for (let c = 1; c <= 6; c++) html += `<th>${c}</th>`;
    html += '</tr>';
    for (let r = 0; r < 6; r++) {
        html += `<tr><th>${r + 1}</th>`;
        for (let c = 0; c < 6; c++) {
            html += `<td><strong>${grid[r][c].char}</strong><br><small style="color:#999">${grid[r][c].coord}</small></td>`;
        }
        html += '</tr>';
    }
    html += '</table>';
    html += '<p style="text-align:center;font-size:9pt;color:#666;">Lecture : Ligne (1er chiffre) puis Colonne (2ème chiffre). Ex: 21 = G</p>';
    html += '</div>';
    return html;
}

function renderVigenereAnnexe(key: string): string {
    const { alphabet, table } = ModuleLogic.getVigenereTable(key);
    let html = `<div class="annexe-section"><h2 class="annexe-title">CARRÉ DE VIGENÈRE — Clé : <code>${key}</code></h2>`;
    html += '<div class="vig-scroll"><table class="annexe-table vig-table"><tr><th></th>';
    for (const c of alphabet) html += `<th>${c}</th>`;
    html += '</tr>';
    for (let i = 0; i < table.length; i++) {
        html += `<tr><th>${alphabet[i]}</th>`;
        for (const c of table[i]) html += `<td>${c}</td>`;
        html += '</tr>';
    }
    html += '</table></div></div>';
    return html;
}

function renderMaritimeAnnexe(): string {
    const nato = ModuleLogic.getNATOAlphabet();
    let html = '<div class="annexe-section"><h2 class="annexe-title">CODE MARITIME (NATO)</h2><div class="nato-grid">';
    for (const [char, word] of Object.entries(nato)) {
        html += `<div class="nato-cell"><span class="nato-char">${char.toUpperCase()}</span><span class="nato-word">${word}</span></div>`;
    }
    html += '</div></div>';
    return html;
}

function renderGilwellAnnexe(): string {
    return `
    <div class="annexe-section">
        <h2 class="annexe-title">GUIDE DU RELEVÉ GILWELL</h2>
        <div style="background: #fff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px 16px; font-size: 9pt; color: #334155; line-height: 1.5;">
            <p style="margin-bottom: 8px;"><strong>Interprétation des azimuts vectoriels :</strong></p>
            <ul style="margin-left: 20px;">
                <li>Le point <strong style="color: #16a34a;">VERT</strong> indique votre position de départ de l'étape.</li>
                <li>Chaque flèche vectorielle indique le cap magnétique en degrés et la distance métrique du segment.</li>
                <li>Le point <strong style="color: #dc2626;">ROUGE</strong> marque l'arrivée du tronçon Gilwell.</li>
            </ul>
        </div>
    </div>`;
}

function renderMapPaginationAnnexe(plan: PaginationPlan, svg?: string): string {
    const scaleLabel = plan.scale >= 1000 ? `1 : ${plan.scale / 1000} 000` : `1 : ${plan.scale}`;
    let html = `
    <div class="annexe-section" style="page-break-before: always; margin-top: 24px;">
        <h2 class="annexe-title">DÉCOUPAGE TOPOGRAPHIQUE DES PLANCHES (${scaleLabel})</h2>
        <div style="background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px 18px; margin-bottom: 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
                <span style="font-size: 10pt; font-weight: bold; color: #0284c7;">
                    🗺️ Plan d'assemblage (${plan.pages.length} feuille${plan.pages.length > 1 ? 's' : ''} A4)
                </span>
                <span style="font-size: 8.5pt; color: #475569;">
                    ${plan.nLandscape > 0 ? `${plan.nLandscape} Paysage` : ''}${plan.mixed ? ' · ' : ''}${plan.nPortrait > 0 ? `${plan.nPortrait} Portrait` : ''} · Recouvrement 10mm
                </span>
            </div>
            ${svg ? `<div style="margin-bottom: 14px; text-align: center;">${svg}</div>` : ''}
            <table style="width: 100%; border-collapse: collapse; font-size: 8pt; color: #334155;">
                <thead>
                    <tr style="background: #f1f5f9; border-bottom: 1px solid #cbd5e1; text-align: left;">
                        <th style="padding: 6px 8px;">Feuille</th>
                        <th style="padding: 6px 8px;">Format & Orient.</th>
                        <th style="padding: 6px 8px;">Centre (Lat, Lon)</th>
                        <th style="padding: 6px 8px;">Emprise (SW / NE)</th>
                        <th style="padding: 6px 8px;">Raccords voisins</th>
                    </tr>
                </thead>
                <tbody>`;

    for (const p of plan.pages) {
        const nbStrs = Object.entries(p.nb).map(([dir, nums]) => `${dir} → F${nums.join(', ')}`).join(' · ') || '—';
        html += `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 6px 8px; font-weight: bold; color: #0284c7;">Feuille ${p.n}</td>
                        <td style="padding: 6px 8px;">A4 ${p.orient === 'landscape' ? 'Paysage' : 'Portrait'}</td>
                        <td style="padding: 6px 8px; font-family: monospace;">${p.center[0].toFixed(5)}, ${p.center[1].toFixed(5)}</td>
                        <td style="padding: 6px 8px; font-family: monospace; font-size: 7.5pt; color: #64748b;">
                            [${p.sw[0].toFixed(4)}, ${p.sw[1].toFixed(4)}] à [${p.ne[0].toFixed(4)}, ${p.ne[1].toFixed(4)}]
                        </td>
                        <td style="padding: 6px 8px; font-weight: 500; color: #d97706;">${nbStrs}</td>
                    </tr>`;
    }

    html += `
                </tbody>
            </table>
        </div>
    </div>`;
    return html;
}

// ─── Step Renderer ────────────────────────────────────────────────────────────

function getModuleFontClass(moduleId: string): string {
    const map: Record<string, string> = {
        morse: 'font-morse',
        vigenere: 'font-vigenere',
        polybe: 'font-polybe',
        cassis: 'font-cassis',
        avocat: 'font-avocat',
        templier: 'font-templier',
        maritime: 'font-maritime',
    };
    return map[moduleId] || '';
}

function renderStep(step: CarnetStep, stepNum: number, isSolution: boolean, themeLabels: Record<string, string>): string {
    const moduleLabel = themeLabels[`${step.moduleId}_label`]
        || ModuleRegistry.getMeta(step.moduleId)?.label
        || step.moduleId;

    const fromTo = step.fromLabel && step.toLabel
        ? `${step.fromLabel} → ${step.toLabel}`
        : step.fromLabel || '';

    // Visual content (Gilwell SVG, map placeholder, Carte Simple)
    let visualContent = '';
    if (step.moduleId === 'gilwell' && step.gilwellSvg) {
        visualContent = `<div class="gilwell-svg">${step.gilwellSvg}</div>`;
    } else if (['carte_ign', 'carte_simple', 'drapeaux'].includes(step.moduleId)) {
        const center = step.mapPersist?.center ? step.mapPersist.center.join(',') : (step.mapCenter ? step.mapCenter.join(',') : '');
        const zoom = step.mapPersist?.zoom || step.mapZoom || 15;
        const h = step.mapPersist?.height ? `${step.mapPersist.height}px` : '240px';
        const w = step.mapPersist?.width ? `${step.mapPersist.width}px` : (step.mapPersist?.widthPercent ? `${step.mapPersist.widthPercent}%` : '100%');
        const isCarteSimple = step.moduleId === 'carte_simple';
        const mapTitle = isCarteSimple ? 'CARTE SIMPLE' : 'CARTE IGN';
        visualContent = `
        <div class="step-map-card">
            <div class="step-map-header">
                <span>🗺️ ${mapTitle} — ${fromTo || 'TRONÇON DIRECT'}</span>
                <span style="color:#64748b; font-weight:normal;">Azimut ${step.azimuth || 0}° &bull; ${step.distanceM || 0}m</span>
            </div>
            <div class="step-map-visual">
                <strong>Suivre le cap ${step.azimuth || 0}° sur ${step.distanceM || 0} mètres.</strong><br>
                <span style="font-size: 8pt; color: #15803d; font-style: italic;">Se repérer directement sur la carte topographique sans chiffrement.</span>
            </div>
            <div class="map-placeholder" data-center="${center}" data-zoom="${zoom}" data-scale="${step.mapPersist?.scaleName || '1:25000'}" data-show-route="${step.mapPersist?.showRoute !== false}" data-show-endpoints="${step.mapPersist?.showEndpoints !== false}" data-show-annotations="${step.mapPersist?.showAnnotations !== false}" style="height:${h}; width:${w}; margin: 6px auto 0 auto; border-radius: 0; border: 1.5px solid #1e293b;">
                [Extrait ${mapTitle} (${step.mapPersist?.scaleName || '1:25 000'}) — zone ${fromTo || 'N/A'}]
            </div>
        </div>`;
    }

    // Text content
    const fontClass = getModuleFontClass(step.moduleId);
    const displayText = isSolution ? step.solutionText : step.encodedText;
    const isEncoded = !isSolution && step.moduleId !== 'texte_clair' && displayText !== step.solutionText;

    let textContent = '';
    if (!['carte_ign', 'carte_simple', 'gilwell'].includes(step.moduleId) && displayText) {
        textContent += '<div class="msg">';
        textContent += `<div class="msg-num">1</div>`;
        if (isEncoded) {
            textContent += `<div><div class="encoded ${fontClass}">${displayText.replace(/\n/g, '<br>')}</div><div class="clair-hint">${step.solutionText}</div></div>`;
        } else {
            textContent += `<div class="visual-msg">${displayText.replace(/\n/g, '<br>')}</div>`;
        }
        textContent += '</div>';
    }

    return `
  <div class="step">
    <div class="step-header">
      <div class="step-num">${stepNum}</div>
      ${fromTo ? `<span>${fromTo}</span>` : ''}
      <span style="margin-left:auto">${moduleLabel}</span>
    </div>
    <div class="step-body">
      ${visualContent}
      ${textContent}
    </div>
  </div>`;
}

// ─── Annotations & Areas Renderer ──────────────────────────────────────────

function renderAnnotationsSection(
    points: PointAnnotation[] = [],
    areas: AreaAnnotation[] = [],
    itineraries: Itinerary[] = []
): string {
    const activePoints = points.filter(p => p.visible !== false);
    const activeAreas = areas.filter(a => a.visible !== false);

    if (activePoints.length === 0 && activeAreas.length === 0 && itineraries.length <= 1) {
        return '';
    }

    let html = `
  <div class="step" style="page-break-inside: avoid; margin-top: 24px;">
    <div class="step-header" style="background: #1e3a2b;">
      <span style="font-size: 13px;">🗺️ Repères & Périmètres Délimités du Raid</span>
    </div>
    <div class="step-body" style="padding: 14px 18px; font-size: 11px;">
`;

    // Multi-itineraries summary
    if (itineraries.length > 1) {
        html += `
      <div style="margin-bottom: 16px;">
        <div style="font-weight: 700; color: #1e3a2b; margin-bottom: 6px; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em;">
          Itinéraires du projet (${itineraries.length}) :
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
`;
        for (const it of itineraries) {
            const dist = (it.routes || []).reduce((acc: number, r: any) => acc + (r?.distance_m || 0), 0) / 1000;
            html += `
          <div style="padding: 6px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid ${it.color || '#2d8ceb'}; border-radius: 4px;">
            <b>${it.name}</b> — ${(dist > 0 ? dist.toFixed(1) + ' km · ' : '')}${it.stages?.length || 0} étapes
          </div>
`;
        }
        html += `
        </div>
      </div>
`;
    }

    // Points de repère
    if (activePoints.length > 0) {
        html += `
      <div style="margin-bottom: 16px;">
        <div style="font-weight: 700; color: #1e3a2b; margin-bottom: 6px; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em;">
          Points de repère & Balises (${activePoints.length}) :
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <thead>
            <tr style="background: #f1f5f9; text-align: left; font-size: 10px; color: #64748b;">
              <th style="padding: 6px 8px; border: 1px solid #e2e8f0;">Repère</th>
              <th style="padding: 6px 8px; border: 1px solid #e2e8f0;">Coordonnées GPS</th>
              <th style="padding: 6px 8px; border: 1px solid #e2e8f0;">Notes & Consignes</th>
            </tr>
          </thead>
          <tbody>
`;
        for (const pt of activePoints) {
            html += `
            <tr>
              <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: 700;">
                <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${pt.color || '#3b82f6'}; margin-right:6px;"></span>
                ${pt.title}
              </td>
              <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-family: monospace; font-size: 10px; color: #475569;">
                ${pt.coords[0].toFixed(5)}, ${pt.coords[1].toFixed(5)}
              </td>
              <td style="padding: 6px 8px; border: 1px solid #e2e8f0; color: #334155;">
                ${pt.text || '—'}
              </td>
            </tr>
`;
        }
        html += `
          </tbody>
        </table>
      </div>
`;
    }

    // Zones & Périmètres
    if (activeAreas.length > 0) {
        html += `
      <div>
        <div style="font-weight: 700; color: #1e3a2b; margin-bottom: 6px; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em;">
          Zones & Périmètres délimités (${activeAreas.length}) :
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <thead>
            <tr style="background: #f1f5f9; text-align: left; font-size: 10px; color: #64748b;">
              <th style="padding: 6px 8px; border: 1px solid #e2e8f0;">Zone</th>
              <th style="padding: 6px 8px; border: 1px solid #e2e8f0;">Superficie calculée</th>
              <th style="padding: 6px 8px; border: 1px solid #e2e8f0;">Sommets</th>
              <th style="padding: 6px 8px; border: 1px solid #e2e8f0;">Règles & Consignes</th>
            </tr>
          </thead>
          <tbody>
`;
        for (const a of activeAreas) {
            const surface = a.formatted_area || formatArea(calculatePolygonArea(a.coords));
            html += `
            <tr>
              <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: 700;">
                <span style="display:inline-block; width:8px; height:8px; border-radius:2px; background:${a.color || '#10b981'}; margin-right:6px;"></span>
                ${a.title}
              </td>
              <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: 700; color: #15803d;">
                ${surface}
              </td>
              <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-size: 10px; color: #64748b;">
                ${a.coords.length} sommets
              </td>
              <td style="padding: 6px 8px; border: 1px solid #e2e8f0; color: #334155;">
                ${a.text || '—'}
              </td>
            </tr>
`;
        }
        html += `
          </tbody>
        </table>
      </div>
`;
    }

    html += `
    </div>
  </div>
`;

    return html;
}

// ─── Main Renderer ────────────────────────────────────────────────────────────

export class ExportHTMLRenderer {

    static render(
        steps: CarnetStep[],
        theme: ThemeData,
        options: ExportRenderOptions,
        fontsBase64: Record<string, string> = {}
    ): string {
        const accent = options.isSolution ? '#b44a2b' : '#2d5a8e';
        const css = buildCSS(accent, options.isSolution, fontsBase64, options.paperSize || 'A4');
        const themeLabels = theme.labels || {};
        const roleLabel = options.isSolution ? 'SOLUTION' : 'PARTICIPANT';

        // ── Head ──
        let html = `<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${options.title} — ${roleLabel}</title>
    <style>${css}</style>
</head>
<body>
  <span class="raid-title-target">${options.title || options.themeTitle || 'CARNET DE ROUTE'}</span>
  <span class="version-title-target">${roleLabel}</span>
`;

        // ── Header ──
        html += `
  <div class="page-header">
    <h1>${options.title || options.themeTitle}</h1>
    <div class="subtitle">${options.title && options.themeTitle && options.themeTitle !== options.title ? `${options.themeTitle} · ` : ''}${steps.length} étapes · ${roleLabel} · ScoutRaider Suite</div>
  </div>
`;

        // ── Profil Altimétrique ──
        if (options.includeElevationProfile && options.elevationSvg) {
            const stats = options.elevationStats;
            html += `
  <div style="margin: 0 0 24px 0; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px 18px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); page-break-inside: avoid;">
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
      <div style="font-weight: 700; color: #0e7490; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;">
        ⛰️ Profil Altimétrique & Topographie du Parcours
      </div>
      ${stats ? `
      <div style="display: flex; gap: 12px; font-size: 10px; color: #475569;">
        <span><b>D+ :</b> +${stats.ascend_m}m</span>
        <span><b>D- :</b> -${stats.descend_m}m</span>
        <span><b>Alt :</b> ${stats.min_alt_m}m / ${stats.max_alt_m}m</span>
        <span><b>Durée marche estimée :</b> ${Math.floor(stats.duration_min / 60)}h${String(stats.duration_min % 60).padStart(2, '0')}</span>
      </div>` : ''}
    </div>
    <div style="width: 100%; overflow: hidden; padding: 4px 0;">
      ${options.elevationSvg}
    </div>
  </div>
`;
        }

        // ── Steps ──
        let stepNum = 1;
        for (const step of steps) {
            html += renderStep(step, stepNum, options.isSolution, themeLabels);
            stepNum++;
        }

        // ── Repères, Zones & Multi-Itinéraires ──
        html += renderAnnotationsSection(
            options.pointAnnotations,
            options.areaAnnotations,
            options.itineraries
        );

        // ── Annexes ──
        if (options.includeAnnexes) {
            const usedModules = new Set(steps.map(s => s.moduleId));

            if (usedModules.has('morse')) {
                html += renderMorseAnnexe();
            }
            if (usedModules.has('polybe')) {
                html += renderPolybeAnnexe();
            }
            if (usedModules.has('vigenere')) {
                html += renderVigenereAnnexe(options.vigenereKey);
            }
            if (usedModules.has('maritime')) {
                html += renderMaritimeAnnexe();
            }
            if (usedModules.has('gilwell')) {
                html += renderGilwellAnnexe();
            }
            if (options.includeMapPagination && options.mapPaginationPlan) {
                html += renderMapPaginationAnnexe(options.mapPaginationPlan, options.mapPaginationSvg);
            }
        }

        // ── Footer ──
        html += `
  <div class="page-footer">ScoutRaider Suite · ${options.themeTitle} · ${roleLabel}</div>
`;

        html += `
</body>
</html>`;

        return html;
    }

    /**
     * Convenience: render both Participant and Solution HTML documents.
     */
    static renderBoth(
        steps: CarnetStep[],
        theme: ThemeData,
        baseOptions: Omit<ExportRenderOptions, 'isSolution'>
    ): { participant: string; solution: string } {
        return {
            participant: this.render(steps, theme, { ...baseOptions, isSolution: false }),
            solution: this.render(steps, theme, { ...baseOptions, isSolution: true }),
        };
    }
}
