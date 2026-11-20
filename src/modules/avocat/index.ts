/**
 * Avocat Module — Standard v2.0
 * Caesar cipher variant: A = K (offset +10).
 */
import { normalizeAccents } from '../utils';

export function encodeAvocat(text: string, offset: number = 10): { encoded_text: string } {
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
  id: 'avocat',
  name: 'Code Avocat',
  capability: 'alphabetic',
  transform: (text: string, options?: { offset?: number }) => encodeAvocat(text, options?.offset ?? 10).encoded_text,
  encode: encodeAvocat
};
