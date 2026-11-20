/**
 * Cassis Module — Standard v2.0
 * K = 6 (shift +21)
 */

export function encodeCassis(text: string): { encoded_text: string } {
  const res: string[] = [];
  for (const c of text.toUpperCase()) {
    if (c >= 'A' && c <= 'Z') {
      res.push(String.fromCharCode((c.charCodeAt(0) - 65 + 21) % 26 + 65));
    } else {
      res.push(c);
    }
  }
  return { encoded_text: res.join('') };
}

export default {
  id: 'cassis',
  name: 'Code Cassis',
  capability: 'alphabetic',
  transform: (text: string) => encodeCassis(text)
};
