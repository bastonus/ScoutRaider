/**
 * Polybe Module — Standard v2.0
 */

const GRID = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const LOOKUP: Record<string, string> = {};
for (let i = 0; i < GRID.length; i++) {
  const row = Math.floor(i / 6) + 1;
  const col = (i % 6) + 1;
  LOOKUP[GRID[i]] = `${row}${col}`;
}

export function encodePolybe(text: string): { encoded_text: string } {
  const upper = text.toUpperCase();
  const encoded = upper.split('').map(c => {
    if (c === ' ') return ' ';
    return LOOKUP[c] || c;
  }).join(' ');
  return { encoded_text: encoded };
}

export default {
  id: 'polybe',
  name: 'Carré de Polybe',
  capability: 'alphanumeric',
  transform: (text: string) => encodePolybe(text)
};
