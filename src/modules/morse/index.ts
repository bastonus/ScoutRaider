/**
 * Morse Module — Standard v2.0
 * Pure TypeScript logic for Morse code encoding and font glyph mapping.
 */
import { normalizeAccents } from '../utils';

export const MORSE_TABLE: Record<string, string> = {
  a: '.-', b: '-...', c: '-.-.', d: '-..', e: '.', f: '..-.',
  g: '--.', h: '....', i: '..', j: '.---', k: '-.-', l: '.-..',
  m: '--', n: '-.', o: '---', p: '.--.', q: '--.-', r: '.-.',
  s: '...', t: '-', u: '..-', v: '...-', w: '.--', x: '-..-',
  y: '-.--', z: '--..', '0': '-----', '1': '.----', '2': '..---',
  '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...',
  '8': '---..', '9': '----.', ' ': '/'
};

export function encodeMorse(text: string): { encoded_text: string; font_text: string; tokens: string[] } {
  const normalized = normalizeAccents(text).toLowerCase();
  
  // 1. Symbolic dots & dashes representation (.-)
  const tokens = normalized.split('').map(c => MORSE_TABLE[c] || c);
  const symbolic = tokens.join(' ');

  // 2. Font glyph compatible representation (Morse font glyph convention)
  const fontText = normalized
    .replace(/\./g, '`')
    .replace(/(\d)/g, '`$1')
    .replace(/[^a-z0-9 `]/g, '');

  return {
    encoded_text: symbolic,
    font_text: fontText,
    tokens
  };
}

export function toMorseFontText(text: string): string {
  return encodeMorse(text).font_text;
}

export function toMorseSymbols(text: string): string {
  return encodeMorse(text).encoded_text;
}

export default {
  id: 'morse',
  name: 'Code Morse International',
  capability: 'alphabetic',
  transform: (text: string, options?: { forFont?: boolean }) => {
    const res = encodeMorse(text);
    return options?.forFont ? res.font_text : res.encoded_text;
  },
  toFontText: toMorseFontText,
  toSymbols: toMorseSymbols,
  table: MORSE_TABLE
};
