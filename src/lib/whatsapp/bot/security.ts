/**
 * Chequeo programático de palabras (case-insensitive, substring simple —
 * sin límites de palabra, para que no dependa de cómo se tildó o separó).
 * Es la segunda capa: la primera es la instrucción explícita al modelo (ver
 * prompt.ts `buildSecurityBlock`) — una instrucción sola no garantiza que el
 * modelo la respete siempre.
 */
export function findMatch(text: string, words: string[]): string | null {
  const lower = text.toLowerCase();
  return words.find((w) => w.trim() && lower.includes(w.trim().toLowerCase())) ?? null;
}
