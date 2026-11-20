/**
 * ModuleLogic.ts — All scout encoding algorithms.
 * Ported from legacy/modules/<name>/module.py
 *
 * Each encoder is called LIVE during editing.
 */
import type { PolySegment } from './types';
import { GilwellEngine, createDefaultGilwellConfig } from '../modules/gilwell/logic/GilwellEngine';
import type { GilwellConfig } from '../modules/gilwell/logic/types';

// Standardized Hub v2 Modules
import { encodeMorse, toMorseFontText, toMorseSymbols, MORSE_TABLE } from '../modules/morse';
import { encodeVigenere, decodeVigenere } from '../modules/vigenere';
import { encodePolybe, POLYBE_GRID, POLYBE_LOOKUP } from '../modules/polybe';
import { encodeAvocat } from '../modules/avocat';
import { encodeCassis } from '../modules/cassis';
import { encodeTemplier } from '../modules/templier';
import { encodeMaritime, NATO_MAP } from '../modules/maritime';
import { normalizeAccents } from '../modules/utils';

// ─── Shared helpers ───────────────────────────────────────────────────────────

function normalizeText(text: string): string {
    return normalizeAccents(text).toLowerCase();
}

// ═════════════════════════════════════════════════════════════════════════════
//  ModuleLogic — static methods for each encoding (Standard v2 Hub Delegation)
// ═════════════════════════════════════════════════════════════════════════════

export class ModuleLogic {

    // ── Morse ────────────────────────────────────────────────────────────────
    static morse(text: string): string {
        return toMorseFontText(text);
    }

    /** Full Morse encode with dots and dashes (for annexe display) */
    static morseWithSymbols(text: string): string {
        return toMorseSymbols(text);
    }

    // ── Vigenère ─────────────────────────────────────────────────────────────
    static vigenere(text: string, key: string, decode: boolean = false): string {
        return encodeVigenere(text, key, decode).encoded_text;
    }

    // ── Polybe (5×5 or 6×6 grid) ────────────────────────────────────────────
    static polybe(text: string): string {
        return encodePolybe(text).encoded_text;
    }

    // ── Avocat (Caesar cipher variant with offset) ──────────────────────────
    static avocat(text: string, offset: number = 10): string {
        return encodeAvocat(text, offset).encoded_text;
    }

    // ── Cassis (Caesar cipher variant with different offset) ─────────────────
    static cassis(text: string, offset: number = 21): string {
        return encodeCassis(text, offset).encoded_text;
    }

    // ── Templier (Templar cross cipher — pigpen variant) ────────────────────
    static templier(text: string): string {
        return encodeTemplier(text).encoded_text;
    }

    // ── Maritime (Flags) ────────────────────────────────────
    static maritime(text: string): string {
        return encodeMaritime(text).encoded_text;
    }

    // ── Texte Clair (passthrough) ────────────────────────────────────────────
    static texteClair(text: string): string {
        return text;
    }

    // ── Carte IGN — no text encoding ─────────────────────────────────────────
    // (map-only module, handled by the UI)

    // ── Drapeaux — flag sequence generation ──────────────────────────────────

    static readonly FLAG_COLORS = [
        { name: 'rouge', rgb: [1, 0, 0] },
        { name: 'bleu', rgb: [0, 0, 1] },
        { name: 'vert', rgb: [0, 0.6, 0] },
        { name: 'jaune', rgb: [1, 1, 0] },
        { name: 'violet', rgb: [0.5, 0, 0.5] },
        { name: 'orange', rgb: [1, 0.5, 0] },
        { name: 'blanc', rgb: [1, 1, 1] },
        { name: 'noir', rgb: [0, 0, 0] },
    ];

    static generateFlagSequence(segments: PolySegment[]): {
        color: string;
        rgb: number[];
        coord: [number, number];
        isFake: boolean;
    }[] {
        const sequence: { color: string; rgb: number[]; coord: [number, number]; isFake: boolean }[] = [];
        const usedColors = new Set<string>();

        for (let i = 0; i < segments.length; i++) {
            const seg = segments[i];
            const coords = seg.coords || [];
            if (!coords.length) continue;

            // Real flag at end of segment
            const endCoord = coords[coords.length - 1];
            let color = this.FLAG_COLORS.find(c => !usedColors.has(c.name)) || this.FLAG_COLORS[0];
            usedColors.add(color.name);
            if (usedColors.size >= this.FLAG_COLORS.length) usedColors.clear();

            sequence.push({
                color: color.name,
                rgb: color.rgb,
                coord: endCoord,
                isFake: false,
            });

            // Possibly add a fake flag (50% chance, not on last segment)
            if (i < segments.length - 1 && Math.random() > 0.5) {
                const fakeColor = this.FLAG_COLORS.find(c => c.name !== color.name && !usedColors.has(c.name)) || this.FLAG_COLORS[1];
                // Place fake flag nearby (random offset)
                const fakeCoord: [number, number] = [
                    endCoord[0] + (Math.random() - 0.5) * 0.002,
                    endCoord[1] + (Math.random() - 0.5) * 0.002,
                ];
                sequence.push({
                    color: fakeColor.name,
                    rgb: fakeColor.rgb,
                    coord: fakeCoord,
                    isFake: true,
                });
            }
        }

        return sequence;
    }

    // ── Gilwell SVG diagram ──────────────────────────────────────────────────

    /** Generate Gilwell SVG from ScoutRaider PolySegments using the new WYSIWYG engine */
    static generateGilwellSVG(segments: PolySegment[], config?: Partial<GilwellConfig>): string {
        const fullConfig = createDefaultGilwellConfig(config);
        return GilwellEngine.generateScoutRaiderSVG(segments, fullConfig);
    }

    /** Generate multi-page Gilwell SVG for print/export (returns array of SVG strings, one per page) */
    static generateGilwellSVGPages(segments: PolySegment[], config?: Partial<GilwellConfig>): string[] {
        const fullConfig = createDefaultGilwellConfig(config);
        const steps = GilwellEngine.fromPolySegments(segments);
        const pages = GilwellEngine.computePages(steps, fullConfig);
        return pages.map(page => GilwellEngine.renderPageToSvgString(page, fullConfig));
    }

    // ── Universal encoder ────────────────────────────────────────────────────

    /** Route encoding call to the appropriate module. Called live during editing. */
    static encode(moduleId: string, text: string, options?: { key?: string; offset?: number }): string {
        switch (moduleId) {
            case 'morse':       return this.morse(text);
            case 'vigenere':    return this.vigenere(text, options?.key || 'MOUSTACHE');
            case 'polybe':      return this.polybe(text);
            case 'gilwell':     return text; // Visual only, no text encoding
            case 'avocat':      return this.avocat(text, options?.offset ?? 10);
            case 'cassis':      return this.cassis(text, options?.offset ?? 21);
            case 'templier':    return this.templier(text);
            case 'maritime':    return this.maritime(text);
            case 'drapeaux':    return text; // Flag narrative handled separately
            case 'texte_clair': return this.texteClair(text);
            case 'carte_simple':
            case 'carte_ign':   return text; // Map module, no encoding
            default:            return text;
        }
    }

    // ── Annexe data (for export/display) ─────────────────────────────────────

    static getMorseTable(): Record<string, string> {
        return { ...MORSE_TABLE };
    }

    static getPolybeGrid(): { char: string; coord: string }[][] {
        const rows: { char: string; coord: string }[][] = [];
        for (let row = 0; row < 6; row++) {
            const cells: { char: string; coord: string }[] = [];
            for (let col = 0; col < 6; col++) {
                const idx = row * 6 + col;
                if (idx < POLYBE_GRID.length) {
                    cells.push({ char: POLYBE_GRID[idx], coord: `${row + 1}${col + 1}` });
                } else {
                    cells.push({ char: '', coord: '' });
                }
            }
            rows.push(cells);
        }
        return rows;
    }

    static getVigenereTable(key: string): { key: string; alphabet: string; table: string[][] } {
        const AB = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const table: string[][] = [];
        for (let i = 0; i < 26; i++) {
            table.push([...AB.slice(i), ...AB.slice(0, i)].map(c => c));
        }
        return { key, alphabet: AB, table };
    }

    static getNATOAlphabet(): Record<string, string> {
        return { ...NATO_MAP };
    }
}
