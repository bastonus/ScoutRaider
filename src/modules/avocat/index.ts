/**
 * Avocat Module — Standard v2.0
 * Shift +10
 */

export function encodeAvocat(text: string): { encoded_text: string } {
  const res: string[] = [];
  for (const c of text.toUpperCase()) {
    if (c >= 'A' && c <= 'Z') {
      res.push(String.fromCharCode((c.charCodeAt(0) - 65 + 10) % 26 + 65));
    } else {
      res.push(c);
    }
  }
  return { encoded_text: res.join('') };
}

export default {
  id: 'avocat',
  name: 'Code Avocat',
  capability: 'alphabetic',
  transform: (text: string) => encodeAvocat(text)
};
