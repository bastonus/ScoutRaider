/**
 * Shared utility functions for ScoutRaider standardized modules (v2.0)
 */

export function normalizeAccents(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/œ/g, 'oe')
    .replace(/Œ/g, 'OE')
    .replace(/æ/g, 'ae')
    .replace(/Æ/g, 'AE')
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'C');
}
