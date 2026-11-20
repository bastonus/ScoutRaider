/**
 * Morse Module — Standard v2.0
 * Pure TypeScript logic for Morse code encoding.
 */

const MORSE_MAP: Record<string, string> = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.',
  G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..',
  M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.',
  S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-',
  Y: '-.--', Z: '--..', '0': '-----', '1': '.----', '2': '..---',
  '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...',
  '8': '---..', '9': '----.', ' ': '/'
};

export function encodeMorse(text: string): { encoded_text: string; tokens: string[] } {
  const normalized = text.toUpperCase();
  const tokens = normalized.split('').map(c => MORSE_MAP[c] || c);
  return {
    encoded_text: tokens.join(' '),
    tokens
  };
}

export default {
  id: 'morse',
  name: 'Code Morse International',
  capability: 'alphabetic',
  transform: (text: string) => encodeMorse(text)
};
