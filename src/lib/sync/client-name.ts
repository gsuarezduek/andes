/**
 * Nombre del cliente a partir del `custdata` de VikRentCar.
 *
 * Convención nueva del staff: la **primera línea** de la nota es el nombre de la
 * persona, y las líneas siguientes son operativas (hora de retiro, precio, etc.).
 * Las notas viejas no seguían esto: arrancan con la hora/precio y el nombre va
 * embebido. Por eso solo tomamos la 1ª línea como nombre cuando **parece** un
 * nombre: sin dígitos ni "$" (toda nota operativa tiene hora o importe; un nombre
 * no). Lógica pura para testear. Ver docs/wordpress-mapping.md.
 */

/** Primera línea del custdata como nombre, si parece un nombre; si no, null. */
export function nameFromNote(note: string | null | undefined): string | null {
  if (!note) return null;
  const first = note.split(/\r\n|\r|\n/, 1)[0]?.trim() ?? "";
  if (!first || first.length > 60) return null;
  // Las notas operativas arrancan con hora/precio (dígitos, "$"); los nombres no.
  if (/[\d$]/.test(first)) return null;
  return first;
}

/**
 * Nombre efectivo de la reserva: el real (de `customers`/`nominative`) si existe;
 * si la reserva vendría "Sin nombre", se intenta con la 1ª línea de la nota.
 */
export function effectiveClientName(
  rawName: string | null | undefined,
  note: string | null | undefined,
): string {
  const raw = (rawName ?? "").trim();
  if (raw && raw.toLowerCase() !== "sin nombre") return raw;
  return nameFromNote(note) ?? (raw || "Sin nombre");
}
