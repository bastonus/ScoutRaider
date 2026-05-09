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

export interface ExportRenderOptions {
    title: string;
    subtitle: string;
    date: string;
    themeTitle: string;
    isSolution: boolean;
    includeGeneralMap: boolean;
    includeAnnexes: boolean;
    vigenereKey: string;
}

// ─── CSS ──────────────────────────────────────────────────────────────────────

function buildCSS(accent: string, isSolution: boolean, fontsBase64: Record<string, string>): string {
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
    size: A4;
    margin: 18mm 15mm 22mm 15mm;
    @bottom-center {
        content: counter(page) " / " counter(pages);
        font-family: 'Segoe UI', sans-serif;
        font-size: 9pt;
        color: #94a3b8;
    }
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
    box-shadow: 0 2px 8px rgba(0,0,0,.08);
    margin-bottom: 20px;
    overflow: hidden;
    page-break-inside: avoid;
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

.map-placeholder {
    width: 100%;
    min-height: 200px;
    background: #e2e8f0;
    border-radius: 4px;
    border: 1px solid #cbd5e1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #64748b;
    font-size: 10pt;
    margin-bottom: 10px;
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
.annexe {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 14px;
    margin-top: 16px;
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

    // Visual content (Gilwell SVG, map placeholder)
    let visualContent = '';
    if (step.moduleId === 'gilwell' && step.gilwellSvg) {
        visualContent = `<div class="gilwell-svg">${step.gilwellSvg}</div>`;
    } else if (['carte_ign', 'drapeaux'].includes(step.moduleId)) {
        visualContent = `<div class="map-placeholder" data-center="${step.mapCenter || ''}" data-zoom="${step.mapZoom || 15}">
            [Carte IGN — zone ${fromTo || 'N/A'}]
        </div>`;
    }

    // Text content
    const fontClass = getModuleFontClass(step.moduleId);
    const displayText = isSolution ? step.solutionText : step.encodedText;
    const isEncoded = !isSolution && step.moduleId !== 'texte_clair' && displayText !== step.solutionText;

    let textContent = '';
    if (!['carte_ign', 'gilwell'].includes(step.moduleId) && displayText) {
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

// ─── Main Renderer ────────────────────────────────────────────────────────────

export class ExportHTMLRenderer {

    static render(
        steps: CarnetStep[],
        theme: ThemeData,
        options: ExportRenderOptions,
        fontsBase64: Record<string, string> = {}
    ): string {
        const accent = options.isSolution ? '#b44a2b' : '#2d5a8e';
        const css = buildCSS(accent, options.isSolution, fontsBase64);
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
`;

        // ── Header ──
        html += `
  <div class="page-header">
    <h1>${options.themeTitle}</h1>
    <div class="subtitle">${steps.length} étapes · ${roleLabel} · ScoutRaider Suite</div>
  </div>
`;

        // ── Steps ──
        let stepNum = 1;
        for (const step of steps) {
            html += renderStep(step, stepNum, options.isSolution, themeLabels);
            stepNum++;
        }

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
