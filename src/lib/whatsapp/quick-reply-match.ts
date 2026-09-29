/**
 * Lógica pura sobre plantillas rápidas ("/") — separada de quick-replies.ts
 * (que tiene `import "server-only"`) porque un componente cliente
 * (SendForm) la necesita para filtrar la lista mientras se tipea, sin ir al
 * servidor por cada tecla.
 */

/**
 * Normaliza un atajo: sin "/" inicial, minúsculas, sin acentos ni espacios.
 * Se aplica tanto al guardar una plantilla como a lo que se tipea después de
 * "/" — así "hórario"/"Horario "/"/horario" todos matchean la misma fila.
 */
export function normalizeShortcut(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^\/+/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9_-]+/g, "");
}

/** Coincidencias por atajo — las que empiezan con la búsqueda primero, después las que solo la contienen. */
export function matchQuickReplies<T extends { shortcut: string }>(replies: T[], query: string): T[] {
  const q = normalizeShortcut(query);
  if (!q) return replies;
  const starts: T[] = [];
  const contains: T[] = [];
  for (const r of replies) {
    const s = r.shortcut.toLowerCase();
    if (s.startsWith(q)) starts.push(r);
    else if (s.includes(q)) contains.push(r);
  }
  return [...starts, ...contains];
}
