export type HighlightPart = { text: string; match: boolean };

/**
 * Separa `text` en fragmentos marcando dónde aparece `query` — sin distinguir
 * mayúsculas/minúsculas, sin tocar tildes (mismo criterio simple que ya usa
 * el buscador de conversaciones de WhatsApp, `conversation-list.tsx`, en vez
 * de `normalizeSearch` — ese pliega acentos con NFD, lo que puede cambiar el
 * largo del string y desalinear los índices contra el texto original).
 */
export function splitByMatch(text: string, query: string): HighlightPart[] {
  const q = query.trim();
  if (!q) return [{ text, match: false }];

  const lowerText = text.toLowerCase();
  const lowerQuery = q.toLowerCase();
  const parts: HighlightPart[] = [];
  let i = 0;
  while (i < text.length) {
    const idx = lowerText.indexOf(lowerQuery, i);
    if (idx === -1) {
      parts.push({ text: text.slice(i), match: false });
      break;
    }
    if (idx > i) parts.push({ text: text.slice(i, idx), match: false });
    parts.push({ text: text.slice(idx, idx + lowerQuery.length), match: true });
    i = idx + lowerQuery.length;
  }
  return parts;
}
