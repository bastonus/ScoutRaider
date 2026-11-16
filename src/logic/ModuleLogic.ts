/**
 * ModuleLogic.ts — All scout encoding algorithms.
 * Ported from legacy/modules/<name>/module.py
 *
 * Each encoder is called LIVE during editing.
 */
import type { PolySegment } from './types';
import { GilwellEngine } from '../modules/gilwell/logic/GilwellEngine';
import type { GilwellConfig } from '../modules/gilwell/logic/types';

// ─── Shared helpers ───────────────────────────────────────────────────────────

function normalizeText(text: string): string {
    return text.toLowerCase()
        .replace(/é/g, 'e').replace(/è/g, 'e').replace(/ê/g, 'e').replace(/ë/g, 'e')
        .replace(/à/g, 'a').replace(/â/g, 'a').replace(/ä/g, 'a')
        .replace(/î/g, 'i').replace(/ï/g, 'i')
        .replace(/ô/g, 'o').replace(/ö/g, 'o')
        .replace(/û/g, 'u').replace(/ù/g, 'u').replace(/ü/g, 'u')
        .replace(/ç/g, 'c').replace(/œ/g, 'oe').replace(/æ/g, 'ae')
        .replace(/ÿ/g, 'y');
}

// ─── Morse ────────────────────────────────────────────────────────────────────

const MORSE_TABLE: Record<string, string> = {
    'a': '.-', 'b': '-...', 'c': '-.-.', 'd': '-..', 'e': '.', 'f': '..-.',
    'g': '--.', 'h': '....', 'i': '..', 'j': '.---', 'k': '-.-', 'l': '.-..',
    'm': '--', 'n': '-.', 'o': '---', 'p': '.--.', 'q': '--.-', 'r': '.-.',
    's': '...', 't': '-', 'u': '..-', 'v': '...-', 'w': '.--', 'x': '-..-',
    'y': '-.--', 'z': '--..', '1': '.----', '2': '..---', '3': '...--',
    '4': '....-', '5': '.....', '6': '-....', '7': '--...', '8': '---..',
    '9': '----.', '0': '-----', ' ': '/'
};

// ─── Polybe grid ──────────────────────────────────────────────────────────────

const POLYBE_GRID = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const POLYBE_LOOKUP: Record<string, string> = {};
for (let i = 0; i < POLYBE_GRID.length; i++) {
    const row = Math.floor(i / 6) + 1;
    const col = (i % 6) + 1;
    POLYBE_LOOKUP[POLYBE_GRID[i].toLowerCase()] = `${row}${col}`;
}

// ─── NATO alphabet ────────────────────────────────────────────────────────────

const NATO: Record<string, string> = {
    'a': 'Alpha', 'b': 'Bravo', 'c': 'Charlie', 'd': 'Delta', 'e': 'Echo',
    'f': 'Foxtrot', 'g': 'Golf', 'h': 'Hotel', 'i': 'India', 'j': 'Juliett',
    'k': 'Kilo', 'l': 'Lima', 'm': 'Mike', 'n': 'November', 'o': 'Oscar',
    'p': 'Papa', 'q': 'Quebec', 'r': 'Romeo', 's': 'Sierra', 't': 'Tango',
    'u': 'Uniform', 'v': 'Victor', 'w': 'Whiskey', 'x': 'X-ray', 'y': 'Yankee',
    'z': 'Zulu', '0': 'Nadazero', '1': 'Unaone', '2': 'Bissotwo',
    '3': 'Terrathree', '4': 'Kartefour', '5': 'Pantafive', '6': 'Soxisix',
    '7': 'Setteseven', '8': 'Oktoeight', '9': 'Novenine',
};

// ═════════════════════════════════════════════════════════════════════════════
//  ModuleLogic — static methods for each encoding
// ═════════════════════════════════════════════════════════════════════════════

export class ModuleLogic {

    // ── Morse ────────────────────────────────────────────────────────────────
    static morse(text: string): string {
        const normalized = normalizeText(text)
            .replace(/\./g, '`')     // dot → backtick (legacy convention)
            .replace(/(\d)/g, '`$1'); // digit separator

        // Keep only alphanumeric + space + backtick
        const clean = normalized.replace(/[^a-z0-9 `]/g, '');
        return clean;
    }

    /** Full Morse encode with dots and dashes (for annexe display) */
    static morseWithSymbols(text: string): string {
        return normalizeText(text)
            .split('')
            .map(c => MORSE_TABLE[c] || c)
            .join(' ');
    }

    // ── Vigenère ─────────────────────────────────────────────────────────────
    static vigenere(text: string, key: string, decode: boolean = false): string {
        let result = '';
        const k = key.toLowerCase();
        for (let i = 0, j = 0; i < text.length; i++) {
            const char = text[i];
            if (char.match(/[a-z]/i)) {
                const isUpper = char === char.toUpperCase();
                const charCode = char.toLowerCase().charCodeAt(0) - 97;
                const keyCode = k[j % k.length].charCodeAt(0) - 97;
                let newCode: number;
                if (decode) {
                    newCode = (charCode - keyCode + 26) % 26;
                } else {
                    newCode = (charCode + keyCode) % 26;
                }
                result += String.fromCharCode(newCode + (isUpper ? 65 : 97));
                j++;
            } else {
                result += char;
            }
        }
        return result;
    }

    // ── Polybe (5×5 or 6×6 grid) ────────────────────────────────────────────
    static polybe(text: string): string {
        return normalizeText(text)
            .split('')
            .map(c => {
                if (c === ' ') return '  ';
                return POLYBE_LOOKUP[c] || c;
            })
            .join(' ');
    }

    // ── Avocat (Caesar cipher variant with offset) ──────────────────────────
    static avocat(text: string, offset: number = 10): string {
        return normalizeText(text)
            .split('')
            .map(c => {
                if (c >= 'a' && c <= 'z') {
                    return String.fromCharCode(((c.charCodeAt(0) - 97 + offset) % 26) + 97);
                }
                return c;
            })
            .join('');
    }

    // ── Cassis (Caesar cipher variant with different offset) ─────────────────
    static cassis(text: string, offset: number = 21): string {
        return normalizeText(text)
            .split('')
            .map(c => {
                if (c >= 'a' && c <= 'z') {
                    return String.fromCharCode(((c.charCodeAt(0) - 97 + offset) % 26) + 97);
                }
                return c;
            })
            .join('');
    }

    // ── Templier (Templar cross cipher — pigpen variant) ────────────────────
    static templier(text: string): string {
        // Templier encoding uses a custom font glyph substitution.
        // The "encoding" is the normalized text — the font renders it as Templar symbols.
        return normalizeText(text).replace(/[^a-z0-9 ]/g, '');
    }

    // ── Maritime (Flags) ────────────────────────────────────
    static maritime(text: string): string {
        // The maritime font maps characters A-Z and 0-9 to flag icons.
        // We just need to normalize and uppercase the text.
        return normalizeText(text).toUpperCase().replace(/[^A-Z0-9 ]/g, '');
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
        return GilwellEngine.generateScoutRaiderSVG(segments, config);
    }

    /** Generate multi-page Gilwell SVG for print/export (returns array of SVG strings, one per page) */
    static generateGilwellSVGPages(segments: PolySegment[], config?: Partial<GilwellConfig>): string[] {
        const steps = GilwellEngine.fromPolySegments(segments);
        const pages = GilwellEngine.computePages(steps, config);
        return pages.map(page => GilwellEngine.renderPageToSvgString(page, config));
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
        return { ...NATO };
    }
}
