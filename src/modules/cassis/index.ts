/**
 * Cassis Module — Standard v2.0
 * Caesar cipher variant: K = 6 (offset +21).
 */
import { normalizeAccents } from '../utils';

export function encodeCassis(text: string, offset: number = 21): { encoded_text: string } {
  const normalized = normalizeAccents(text).toLowerCase();
  const encoded = normalized
    .split('')
    .map(c => {
      if (c >= 'a' && c <= 'z') {
        return String.fromCharCode(((c.charCodeAt(0) - 97 + offset) % 26) + 97);
      }
      return c;
    })
    .join('');

  return { encoded_text: encoded };
}

export default {
  id: 'cassis',
  name: 'Code Cassis',
  capability: 'alphabetic',
  transform: (text: string, options?: { offset?: number }) => encodeCassis(text, options?.offset ?? 21).encoded_text,
  encode: encodeCassis
};
