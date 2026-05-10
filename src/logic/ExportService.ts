/**
 * ExportService.ts — HTML-first export pipeline with WeasyPrint support.
 *
 * Architecture:
 *   1. ExportHTMLRenderer generates a self-contained HTML document
 *   2. ExportService dispatches to the chosen format:
 *      - html  → direct file save
 *      - pdf   → WeasyPrint (preferred) or Electron printToPDF (fallback)
 *      - csv   → standalone CSV generation
 *
 * The HTML is the single source of truth for all visual exports.
 */

import { ExportHTMLRenderer } from './ExportHTMLRenderer';
import type { ExportRenderOptions } from './ExportHTMLRenderer';
import { themeManager } from './ThemeManager';
import { MODULE_META } from './ModuleRegistry';
import type { AppState, ThemeOverrides, ExportFormat, ModuleId } from './types';

// ─── Export Options ───────────────────────────────────────────────────────────

export type CsvColumnKey = 'step_label' | 'stage_loc' | 'stage_address' | 'number' | 'node_loc' | 'azimuth' | 'distance' | 'km_total' | 'km_leg' | 'module' | 'text_solution' | 'text_encoded' | 'pois_exploded' | 'pois_merged';

export const CSV_COLUMNS: { key: CsvColumnKey; label: string }[] = [
    { key: 'step_label',     label: 'étape' },
    { key: 'stage_loc',      label: 'coord. étape' },
    { key: 'stage_address',  label: 'adresse étape' },
    { key: 'number',         label: 'nœud #' },
    { key: 'node_loc',       label: 'coord. nœud' },
    { key: 'azimuth',        label: 'azimut (°)' },
    { key: 'distance',       label: 'segment (m)' },
    { key: 'km_leg',         label: 'cumul étape (m)' },
    { key: 'km_total',       label: 'cumul total (m)' },
    { key: 'module',         label: 'module' },
    { key: 'text_encoded',   label: 'énigme' },
    { key: 'text_solution',  label: 'solution' },
    { key: 'pois_exploded',  label: 'landmarks (colonnes)' },
    { key: 'pois_merged',    label: 'landmarks (liste)' },
];

export interface ExportPipelineOptions {
    title: string;
    subtitle: string;
    includeGeneralMap: boolean;
    includeAnnexes: boolean;
    /** 'participant' | 'solution' | 'both' */
    version: 'participant' | 'solution' | 'both';
    /** 'weasyprint' | 'electron' | 'auto' */
    pdfEngine: 'weasyprint' | 'electron' | 'auto';
    /** Columns to include in CSV export */
    csvColumns?: CsvColumnKey[];
    /** Separator for CSV export (default: ';') */
    csvSeparator?: string;
    /** Max number of POI columns to include */
    csvMaxPois?: number;
    /** Map of stage id -> reverse geocoded address */
    enrichedAddresses?: Record<string, string>;
}

// ─── Electron API type ────────────────────────────────────────────────────────

interface ElectronExportAPI {
    showSaveDialog: (defaultName: string, ext: string) => Promise<string | null>;
    exportFile: (html: string, format: string, outputPath: string) => Promise<boolean>;
    readFile: (path: string) => Promise<string>;
    readFileBase64?: (path: string) => Promise<string | null>;
    writeFile: (path: string, data: string) => Promise<boolean>;
    convertHtmlToPdf?: (html: string, outputPath: string) => Promise<{ success: boolean; error?: string }>;
    checkWeasyPrint?: () => Promise<{ available: boolean; version?: string }>;
}

function getElectronAPI(): ElectronExportAPI | null {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
        return (window as any).electronAPI as ElectronExportAPI;
    }
    return null;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class ExportService {

    /**
     * Check if WeasyPrint is available on the system.
     */
    static async checkWeasyPrint(): Promise<{ available: boolean; version?: string }> {
        const api = getElectronAPI();
        if (api?.checkWeasyPrint) {
            try {
                return await api.checkWeasyPrint();
            } catch {
                return { available: false };
            }
        }
        return { available: false };
    }

    /**
     * Main export entry point.
     * Generates HTML from state, then dispatches to the requested format.
     */
    static async performExport(
        state: AppState,
        format: ExportFormat,
        options: ExportPipelineOptions
    ): Promise<boolean> {
        try {
            // CSV is standalone — no HTML needed
            if (format === 'csv') {
                return await this.exportCSV(state, options);
            }

            // 1. Gather theme
            const theme = themeManager.currentTheme;
            const overrides: ThemeOverrides = state.theme_overrides || {};
            const mergedTheme = { ...theme, ...overrides };

            // 2. Build render options
            const baseOpts: Omit<ExportRenderOptions, 'isSolution'> = {
                title: options.title || 'Carnet de Route',
                subtitle: options.subtitle || '',
                date: options.subtitle || new Date().toLocaleDateString('fr-FR'),
                themeTitle: themeManager.getLabel('main_title', 'CARNET DE ROUTE'),
                includeGeneralMap: options.includeGeneralMap,
                includeAnnexes: options.includeAnnexes ?? true,
                vigenereKey: themeManager.getVigenereKey(),
            };

            console.log(`[ExportService] Generating HTML for ${format} export (version: ${options.version})...`);

            // 3. Load Fonts as Base64 for WeasyPrint embedding
            const api = getElectronAPI();
            const fontsBase64: Record<string, string> = {};
            
            const usedModules = new Set(state.carnet_steps.map(s => s.moduleId));
            if (usedModules.has('morse')) {
                if (api?.readFileBase64) {
                    const base64 = await api.readFileBase64('public/fonts/morse.ttf');
                    if (base64) fontsBase64.morse = base64;
                } else {
                    try {
                        const res = await fetch('/fonts/morse.ttf');
                        const buffer = await res.arrayBuffer();
                        const bytes = new Uint8Array(buffer);
                        let binary = '';
                        for (let i = 0; i < bytes.byteLength; i++) {
                            binary += String.fromCharCode(bytes[i]);
                        }
                        fontsBase64.morse = btoa(binary);
                    } catch (e) { console.warn('Could not fetch morse font', e); }
                }
            }
            if (usedModules.has('templier')) {
                if (api?.readFileBase64) {
                    const base64 = await api.readFileBase64('public/fonts/TemplarsCipherPlus.ttf');
                    if (base64) fontsBase64.templier = base64;
                } else {
                    try {
                        const res = await fetch('/fonts/TemplarsCipherPlus.ttf');
                        const buffer = await res.arrayBuffer();
                        const bytes = new Uint8Array(buffer);
                        let binary = '';
                        for (let i = 0; i < bytes.byteLength; i++) {
                            binary += String.fromCharCode(bytes[i]);
                        }
                        fontsBase64.templier = btoa(binary);
                    } catch (e) { console.warn('Could not fetch templier font', e); }
                }
            }
            if (usedModules.has('drapeaux') || usedModules.has('maritime')) {
                if (api?.readFileBase64) {
                    const base64 = await api.readFileBase64('public/fonts/mari-01.ttf');
                    if (base64) fontsBase64.maritime = base64;
                } else {
                    try {
                        const res = await fetch('/fonts/mari-01.ttf');
                        const buffer = await res.arrayBuffer();
                        const bytes = new Uint8Array(buffer);
                        let binary = '';
                        for (let i = 0; i < bytes.byteLength; i++) {
                            binary += String.fromCharCode(bytes[i]);
                        }
                        fontsBase64.maritime = btoa(binary);
                    } catch (e) { console.warn('Could not fetch maritime font', e); }
                }
            }

            // 4. Determine which versions to generate
            const versions: { label: string; isSolution: boolean }[] = [];
            if (options.version === 'participant' || options.version === 'both') {
                versions.push({ label: 'Participant', isSolution: false });
            }
            if (options.version === 'solution' || options.version === 'both') {
                versions.push({ label: 'Solution', isSolution: true });
            }

            // 5. For each version, generate HTML and export
            for (const ver of versions) {
                const htmlPayload = ExportHTMLRenderer.render(
                    state.carnet_steps,
                    mergedTheme,
                    { ...baseOpts, isSolution: ver.isSolution },
                    fontsBase64
                );

                const suffix = ver.isSolution ? '_SOLUCE' : '';
                const safeName = (options.title || 'Carnet').replace(/\s+/g, '_');

                if (format === 'html') {
                    const ok = await this.saveHTML(htmlPayload, `${safeName}${suffix}.html`);
                    if (!ok) return false;
                } else if (format === 'pdf') {
                    const ok = await this.exportPDF(htmlPayload, `${safeName}${suffix}.pdf`, options.pdfEngine);
                    if (!ok) return false;
                } else if (format === 'docx') {
                    // DOCX: save as HTML for now (user can open in Word)
                    console.warn('[ExportService] DOCX: exporting as HTML (Word-compatible).');
                    const ok = await this.saveHTML(htmlPayload, `${safeName}${suffix}.html`);
                    if (!ok) return false;
                }
            }

            return true;
        } catch (error) {
            console.error('[ExportService] Export failed:', error);
            throw error;
        }
    }

    // ─── HTML Save ────────────────────────────────────────────────────────────

    private static async saveHTML(html: string, defaultFilename: string): Promise<boolean> {
        const api = getElectronAPI();

        if (api) {
            const outputPath = await api.showSaveDialog(defaultFilename, 'html');
            if (!outputPath) return false; // User cancelled
            await api.writeFile(outputPath, html);
            console.log(`[ExportService] HTML saved to ${outputPath}`);
            return true;
        } else {
            // Browser fallback
            const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = defaultFilename;
            a.click();
            URL.revokeObjectURL(a.href);
            return true;
        }
    }

    // ─── PDF Export ───────────────────────────────────────────────────────────

    private static async exportPDF(
        html: string,
        defaultFilename: string,
        engine: 'weasyprint' | 'electron' | 'auto'
    ): Promise<boolean> {
        const api = getElectronAPI();
        if (!api) {
            console.warn('[ExportService] No Electron API. Cannot generate PDF.');
            // Browser fallback: save as HTML instead
            return this.saveHTML(html, defaultFilename.replace('.pdf', '.html'));
        }

        const outputPath = await api.showSaveDialog(defaultFilename, 'pdf');
        if (!outputPath) return false; // User cancelled

        // Try WeasyPrint first if requested
        if (engine === 'weasyprint' || engine === 'auto') {
            if (api.convertHtmlToPdf) {
                console.log('[ExportService] Attempting WeasyPrint conversion...');
                try {
                    const result = await api.convertHtmlToPdf(html, outputPath);
                    if (result.success) {
                        console.log(`[ExportService] WeasyPrint PDF saved to ${outputPath}`);
                        return true;
                    }
                    console.warn('[ExportService] WeasyPrint failed:', result.error);
                    if (engine === 'weasyprint') {
                        throw new Error(`WeasyPrint conversion failed: ${result.error}`);
                    }
                    // Fall through to Electron if engine is 'auto'
                } catch (err) {
                    if (engine === 'weasyprint') throw err;
                    console.warn('[ExportService] WeasyPrint unavailable, falling back to Electron printToPDF...');
                }
            }
        }

        // Electron printToPDF fallback
        console.log('[ExportService] Using Electron printToPDF...');
        return await api.exportFile(html, 'pdf', outputPath);
    }

    // ─── CSV Export ───────────────────────────────────────────────────────────

    /**
     * Génère la chaîne de caractères du fichier CSV.
     */
    static generateCSVString(
        state: AppState,
        options: ExportPipelineOptions
    ): string {
        const BOM = '\uFEFF';
        const SEP = options.csvSeparator || ';';
        const NL = '\r\n';

        // ── Helpers ─────────────────────────────────────────────────────────
        const q = (s: string) => `"${(s || '').replace(/"/g, '""')}"`;
        /** Format a number: if decimals > 0, use comma as decimal separator (French locale). */
        const fmt = (n: number, decimals = 0) =>
            decimals > 0 ? n.toFixed(decimals).replace('.', ',') : String(Math.round(n));
        const fmtKm = (m: number) => fmt(m / 1000, 3);
        const fmtM  = (m: number) => String(Math.round(m));
        
        const formatCoords = (coords?: [number, number]) => {
            if (!coords) return '';
            const lat = coords[0];
            const lon = coords[1];
            
            const toDMS = (coord: number, isLat: boolean) => {
                const absolute = Math.abs(coord);
                const degrees = Math.floor(absolute);
                const minutesNotTruncated = (absolute - degrees) * 60;
                const minutes = Math.floor(minutesNotTruncated);
                const seconds = Math.floor((minutesNotTruncated - minutes) * 60);
                const dir = isLat ? (coord >= 0 ? "N" : "S") : (coord >= 0 ? "E" : "W");
                return `${degrees}°${minutes}'${seconds}"${dir}`;
            };
            return `${toDMS(lat, true)} ${toDMS(lon, false)}`;
        };

        const cols = options.csvColumns || CSV_COLUMNS.map(c => c.key);
        const stages = state.stages || [];
        const addresses = options.enrichedAddresses || {};
        const computedSteps = state.carnet_steps.filter(s => !s.isManual);

        // Calculate max POIs across all segments to size the columns correctly
        let autoMaxPois = 0;
        if (cols.includes('pois_exploded')) {
            for (const step of state.carnet_steps) {
                if (step.isManual) continue;
                for (const segIdx of step.segmentIndices || []) {
                    const segPois = state.segment_pois?.[segIdx.toString()] || [];
                    autoMaxPois = Math.max(autoMaxPois, segPois.length);
                }
            }
        }
        const maxPois = options.csvMaxPois !== undefined ? options.csvMaxPois : (autoMaxPois || 1);

        // ── 1. En-tête du projet ─────────────────────────────────────────────
        const dateStr = options.subtitle || new Date().toLocaleDateString('fr-FR');
        const title   = options.title || 'Carnet de Route';

        let csv = BOM;
        const totalCols = cols.length + (cols.includes('pois_exploded') ? maxPois - 1 : 0);
        csv += `${q(title)}${SEP.repeat(totalCols)}${NL}`;
        csv += `Date${SEP}${q(dateStr)}${SEP.repeat(Math.max(0, totalCols - 1))}${NL}`;
        csv += NL;

        // ── 2. Unified Table Header ──────────────────────────────────────────
        const headers: string[] = [];
        for (const c of cols) {
            if (c === 'pois_exploded') {
                for (let i = 1; i <= maxPois; i++) headers.push(`poi #${i}`);
            } else {
                headers.push(CSV_COLUMNS.find(x => x.key === c)?.label || c);
            }
        }
        csv += headers.join(SEP) + NL;

        // ── 3. Table Rows ────────────────────────────────────────────────────
        let cumulativeM  = 0;
        let lastLegLabel = '';
        let legCumulM    = 0;
        let stepNumber   = 0;
        let isFirstRowOfLeg = false;

        let lastLegKey = '';
        const processedLegs = new Set<string>();

        for (const step of state.carnet_steps) {
            if (step.isManual) {
                const row: string[] = [];
                for (const c of cols) {
                    if (c === 'module') row.push(q('Manuel'));
                    else if (c === 'text_solution') row.push(q(step.solutionText || ''));
                    else if (c === 'text_encoded') row.push(q(step.encodedText || ''));
                    else if (c === 'pois_exploded') {
                        for (let i = 0; i < maxPois; i++) row.push('');
                    } else {
                        row.push('');
                    }
                }
                csv += row.join(SEP) + NL;
                continue;
            }

            const segmentIndices = step.segmentIndices || [];
            const solutionLines  = (step.solutionText || '').split('\n');
            const encodedLines   = (step.encodedText || '').split('\n');
            
            for (let i = 0; i < segmentIndices.length; i++) {
                const segIdx = segmentIndices[i];
                const seg = state.polygonal_steps[segIdx];
                if (!seg) continue;

                const currentLegKey = seg.leg_key || '';
                const isNewLeg = !processedLegs.has(currentLegKey);

                if (isNewLeg) {
                    if (processedLegs.size > 0) csv += NL;
                    processedLegs.add(currentLegKey);
                    lastLegKey = currentLegKey;
                    legCumulM = 0;
                    isFirstRowOfLeg = true;
                }

                // Robust stage detection: the N-th leg processed corresponds to the N-th stage as "From"
                const legOrderIdx = processedLegs.size - 1; 
                const fromStage = state.stages[legOrderIdx];
                let stepFrom = fromStage?.label || '';
                
                // Fallback to carnet step label if stages array is inconsistent
                if (!stepFrom && isFirstRowOfLeg) stepFrom = step.fromLabel || '';

                stepNumber++;
                legCumulM   += seg.distance || 0;
                cumulativeM += seg.distance || 0;

                const moduleLabel = MODULE_META[step.moduleId as ModuleId]?.label || step.moduleId;
                const segPois = state.segment_pois?.[segIdx.toString()] || [];

                const row: string[] = [];
                for (const c of cols) {
                    switch(c) {
                        case 'step_label': 
                            row.push(isFirstRowOfLeg ? q(stepFrom || '?') : ''); 
                            break;
                        case 'stage_loc': 
                            row.push(isFirstRowOfLeg ? q(formatCoords(fromStage?.coords)) : ''); 
                            break;
                        case 'stage_address': 
                            const addr = fromStage ? (addresses[fromStage.id] || fromStage.address || '—') : '—';
                            row.push(isFirstRowOfLeg ? q(addr) : ''); 
                            break;
                        case 'number': 
                            row.push(`"#${stepNumber}"`); 
                            break;
                        case 'node_loc': 
                            row.push(q(formatCoords(seg.coords?.[0]))); 
                            break;
                        case 'azimuth': 
                            row.push(seg.azimut !== undefined ? q(fmt(seg.azimut)) : ''); 
                            break;
                        case 'distance': 
                            row.push(fmtM(seg.distance || 0)); 
                            break;
                        case 'km_total': 
                            row.push(fmtM(cumulativeM)); 
                            break;
                        case 'km_leg': 
                            row.push(fmtM(legCumulM)); 
                            break;
                        case 'module': 
                            row.push(q(moduleLabel)); 
                            break;
                        case 'text_solution': 
                            row.push(q(solutionLines[i] || '')); 
                            break;
                        case 'text_encoded': 
                            row.push(q(encodedLines[i] || '')); 
                            break;
                        case 'pois_exploded':
                            for (let j = 0; j < maxPois; j++) {
                                const p = segPois[j];
                                row.push(p ? q(p.name) : '');
                            }
                            break;
                        case 'pois_merged':
                            const selectedPois = segPois.filter(p => p.selected).map(p => p.name);
                            const otherPois    = segPois.filter(p => !p.selected).map(p => p.name);
                            let poisStr = '';
                            if (selectedPois.length > 0) poisStr += selectedPois.join(', ');
                            if (otherPois.length > 0)    poisStr += (poisStr ? ' | autres: ' : '') + otherPois.join(', ');
                            row.push(q(poisStr));
                            break;
                        default:
                            row.push('');
                            break;
                    }
                }

                csv += row.join(SEP) + NL;
                isFirstRowOfLeg = false;
            }
        }

        // ── 4. Total ─────────────────────────────────────────────────────────
        const totalDist = computedSteps.reduce((s, step) => s + step.distanceM, 0);
        csv += NL;
        const totalRow: string[] = [];
        for (const c of cols) {
            if (c === 'step_label' || (c === 'number' && !cols.includes('step_label'))) totalRow.push(q('TOTAL'));
            else if (c === 'distance') totalRow.push(q(fmt(totalDist) + 'm'));
            else if (c === 'km_total') totalRow.push(fmtKm(totalDist));
            else if (c === 'pois_exploded') {
                for (let i = 0; i < maxPois; i++) totalRow.push('');
            } else {
                totalRow.push('');
            }
        }
        csv += totalRow.join(SEP) + NL;

        return csv;
    }

    /**
     * Génère et sauvegarde le fichier CSV.
     */
    static async exportCSV(
        state: AppState,
        options: ExportPipelineOptions
    ): Promise<boolean> {
        const csv = this.generateCSVString(state, options);
        const title = options.title || 'Carnet de Route';

        // ── Sauvegarde ───────────────────────────────────────────────────────
        const defaultFilename = `Carnet_${title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
        const api = getElectronAPI();

        if (api) {
            const outputPath = await api.showSaveDialog(defaultFilename, 'csv');
            if (!outputPath) return false;
            await api.writeFile(outputPath, csv);
            console.log(`[ExportService] CSV saved to ${outputPath}`);
            return true;
        } else {
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = defaultFilename;
            a.click();
            URL.revokeObjectURL(a.href);
            return true;
        }
    }
}
