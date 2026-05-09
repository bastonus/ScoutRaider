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

export interface ExportPipelineOptions {
    title: string;
    subtitle: string;
    includeGeneralMap: boolean;
    includeAnnexes: boolean;
    /** 'participant' | 'solution' | 'both' */
    version: 'participant' | 'solution' | 'both';
    /** 'weasyprint' | 'electron' | 'auto' */
    pdfEngine: 'weasyprint' | 'electron' | 'auto';
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

    static async exportCSV(
        state: AppState,
        options: { title: string; subtitle: string; includeGeneralMap: boolean }
    ): Promise<boolean> {
        const BOM = '\uFEFF';
        const SEP = ';';
        const NL = '\r\n';

        const headers = [
            'N°', 'Module', 'Distance (m)', 'Azimut (°)',
            'De', 'Vers', 'Texte Solution', 'Texte Encodé', 'POIs'
        ];

        let csv = BOM;
        csv += `# ${options.title || 'Carnet de Route'} — ${options.subtitle || new Date().toLocaleDateString('fr-FR')}` + NL;
        csv += headers.join(SEP) + NL;

        state.carnet_steps.forEach((step, idx) => {
            const moduleLabel = MODULE_META[step.moduleId as ModuleId]?.label || step.moduleId;
            const poiNames = step.pois?.filter(p => p.selected).map(p => p.name).join(', ') || '';
            const row = [
                idx + 1,
                `"${moduleLabel}"`,
                Math.round(step.distanceM),
                step.azimuth,
                `"${step.fromLabel || ''}"`,
                `"${step.toLabel || ''}"`,
                `"${(step.solutionText || '').replace(/"/g, '""')}"`,
                `"${(step.encodedText || '').replace(/"/g, '""')}"`,
                `"${poiNames}"`
            ];
            csv += row.join(SEP) + NL;
        });

        const totalDist = state.carnet_steps.reduce((s, step) => s + step.distanceM, 0);
        csv += NL + `TOTAL${SEP}${SEP}${Math.round(totalDist)}${SEP}${SEP}${SEP}${SEP}${SEP}${SEP}` + NL;

        const defaultFilename = `Carnet_${(options.title || 'Route').replace(/\s+/g, '_')}_${Date.now()}.csv`;
        const api = getElectronAPI();

        if (api) {
            const outputPath = await api.showSaveDialog(defaultFilename, 'csv');
            if (!outputPath) return false;
            await api.writeFile(outputPath, csv);
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
