/**
 * Polybe Module — Standard v2.0
 * 6x6 Polybius checkerboard encoding (A-Z, 0-9).
 */
import { normalizeAccents } from '../utils';

export const POLYBE_GRID = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export const POLYBE_LOOKUP: Record<string, string> = {};

for (let i = 0; i < POLYBE_GRID.length; i++) {
  const row = Math.floor(i / 6) + 1;
  const col = (i % 6) + 1;
  POLYBE_LOOKUP[POLYBE_GRID[i].toLowerCase()] = `${row}${col}`;
}

export function encodePolybe(text: string): { encoded_text: string } {
  const normalized = normalizeAccents(text).toLowerCase();
  const encoded = normalized
    .split('')
    .map(c => {
      if (c === ' ') return '  ';
      return POLYBE_LOOKUP[c] || c;
    })
    .join(' ');

  return { encoded_text: encoded };
}

export default {
  id: 'polybe',
  name: 'Carré de Polybe',
  capability: 'alphanumeric',
  transform: (text: string) => encodePolybe(text).encoded_text,
  encode: encodePolybe,
  lookup: POLYBE_LOOKUP,
  grid: POLYBE_GRID
};
