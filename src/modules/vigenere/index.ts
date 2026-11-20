/**
 * Vigenère Module — Standard v2.0
 * Polyalphabetic encryption with configurable key and decode support.
 */
import { normalizeAccents } from '../utils';

export function encodeVigenere(
  text: string,
  key: string = 'SCOUT',
  decode: boolean = false
): { encoded_text: string; key: string } {
  const cleanKey = normalizeAccents(key).toLowerCase().replace(/[^a-z]/g, '') || 'scout';
  const cleanText = normalizeAccents(text);
  let result = '';
  let j = 0;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    if (char.match(/[a-z]/i)) {
      const isUpper = char === char.toUpperCase();
      const charCode = char.toLowerCase().charCodeAt(0) - 97;
      const keyCode = cleanKey[j % cleanKey.length].charCodeAt(0) - 97;
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

  return {
    encoded_text: result,
    key: cleanKey.toUpperCase()
  };
}

export function decodeVigenere(text: string, key: string): string {
  return encodeVigenere(text, key, true).encoded_text;
}

export default {
  id: 'vigenere',
  name: 'Chiffre de Vigenère',
  capability: 'alphanumeric',
  transform: (text: string, options?: { key?: string; decode?: boolean }) => {
    return encodeVigenere(text, options?.key, options?.decode).encoded_text;
  },
  encode: encodeVigenere,
  decode: decodeVigenere
};
