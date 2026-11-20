/**
 * Vigenère Module — Standard v2.0
 */

export function encodeVigenere(text: string, key: string = 'SCOUT'): { encoded_text: string; key: string } {
  let result = '';
  const k = key.toUpperCase() || 'SCOUT';
  let j = 0;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char.match(/[a-z]/i)) {
      const isUpper = char === char.toUpperCase();
      const charCode = char.toUpperCase().charCodeAt(0) - 65;
      const keyCode = k[j % k.length].charCodeAt(0) - 65;
      const newCode = (charCode + keyCode) % 26;
      result += String.fromCharCode(newCode + (isUpper ? 65 : 97));
      j++;
    } else {
      result += char;
    }
  }

  return {
    encoded_text: result,
    key: k
  };
}

export default {
  id: 'vigenere',
  name: 'Chiffre de Vigenère',
  capability: 'alphanumeric',
  transform: (text: string, options?: { key?: string }) => encodeVigenere(text, options?.key)
};
