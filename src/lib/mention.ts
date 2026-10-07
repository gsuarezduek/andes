/**
 * Lógica pura de @menciones en un textarea — separada del componente
 * (`MentionTextarea`) para poder testearla sin DOM, mismo criterio que
 * `quick-reply-match.ts` con el "/" de WhatsApp.
 */

/**
 * Busca el "@" que abre una mención activa en el cursor: el último "@" antes
 * del cursor, sin espacios entre ese "@" y el cursor. Devuelve lo tipeado
 * después del "@" (la búsqueda) o `null` si no hay una mención en curso.
 */
export function activeMentionQuery(text: string, cursor: number): string | null {
  const uptoCursor = text.slice(0, cursor);
  const at = uptoCursor.lastIndexOf("@");
  if (at === -1) return null;
  const afterAt = uptoCursor.slice(at + 1);
  if (/\s/.test(afterAt)) return null;
  return afterAt;
}

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Coincidencias por nombre — contiene la búsqueda en cualquier posición (sin tildes/mayúsculas). */
export function matchMentionCandidates<T extends { name: string }>(
  candidates: T[],
  query: string,
  max: number,
): T[] {
  const q = normalize(query);
  if (!q) return candidates.slice(0, max);
  return candidates.filter((c) => normalize(c.name).includes(q)).slice(0, max);
}

/**
 * Inserta "@Nombre " en el texto, reemplazando la mención en curso (desde el
 * último "@" antes del cursor hasta el cursor) — inversa de
 * `activeMentionQuery`. Devuelve el texto resultante, el texto insertado
 * (para poder detectar después si se borró) y dónde queda el cursor.
 */
export function insertMention(
  text: string,
  cursor: number,
  name: string,
): { text: string; insertedText: string; caret: number } | null {
  const uptoCursor = text.slice(0, cursor);
  const at = uptoCursor.lastIndexOf("@");
  if (at === -1) return null;
  const insertedText = `@${name}`;
  const rest = text.slice(cursor);
  // Un espacio de separación después de la mención — salvo que el texto que
  // sigue ya empiece con uno, para no dejar un doble espacio al insertar en
  // medio de una palabra ya seguida de más texto. Al final del texto
  // (`rest` vacío) sí se agrega, para poder seguir escribiendo después.
  const separator = /^\s/.test(rest) ? "" : " ";
  const next = `${text.slice(0, at)}${insertedText}${separator}${rest}`;
  return { text: next, insertedText, caret: at + insertedText.length + separator.length };
}
