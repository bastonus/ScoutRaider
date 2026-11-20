/**
 * Maritime Module — Standard v2.0
 * NATO signal flags and phonetics.
 */
import { normalizeAccents } from '../utils';

export const NATO_MAP: Record<string, string> = {
  A: 'Alpha', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo',
  F: 'Foxtrot', G: 'Golf', H: 'Hotel', I: 'India', J: 'Juliett',
  K: 'Kilo', L: 'Lima', M: 'Mike', N: 'November', O: 'Oscar',
  P: 'Papa', Q: 'Quebec', R: 'Romeo', S: 'Sierra', T: 'Tango',
  U: 'Uniform', V: 'Victor', W: 'Whiskey', X: 'X-ray', Y: 'Yankee', Z: 'Zulu',
  '0': 'Nadazero', '1': 'Unaone', '2': 'Bissotwo', '3': 'Terrathree',
  '4': 'Kartefour', '5': 'Pantafive', '6': 'Soxisix', '7': 'Setteseven',
  '8': 'Oktoeight', '9': 'Novenine'
};

export function encodeMaritime(text: string): { encoded_text: string; font_text: string; nato_tokens: string[] } {
  const normalized = normalizeAccents(text).toUpperCase();
  const fontText = normalized.replace(/[^A-Z0-9 ]/g, '');
  const tokens = fontText.split('').map(c => NATO_MAP[c] || c);

  return {
    encoded_text: fontText,
    font_text: fontText,
    nato_tokens: tokens
  };
}

export default {
  id: 'maritime',
  name: 'Pavillons Maritimes',
  capability: 'symbolic_visual',
  transform: (text: string) => encodeMaritime(text).encoded_text,
  encode: encodeMaritime,
  natoTable: NATO_MAP
};
