import { diffDaysKeys } from "./ical";

/**
 * Posición de una estadía en la grilla del Calendario, en MEDIAS columnas
 * desde el borde izquierdo de la ventana. Ocupa una columna entera por noche:
 * del día de entrada al día anterior a la salida (la salida es exclusiva), así
 * una estadía de 1 noche ocupa 1 sola columna. Una salida y una entrada el
 * mismo día quedan una al lado de la otra sin pisarse. Las medias columnas se
 * mantienen para no cambiar las unidades del resto de la grilla. Recortada a la
 * ventana visible; `null` si no la toca.
 */
export function roomBarGeometry(
  startKey: string,
  endKey: string,
  windowStartKey: string,
  days: number,
): { startHalf: number; endHalf: number; clippedStart: boolean; clippedEnd: boolean } | null {
  const rawStart = 2 * diffDaysKeys(windowStartKey, startKey);
  const rawEnd = 2 * diffDaysKeys(windowStartKey, endKey);
  const max = 2 * days;
  if (rawEnd <= 0 || rawStart >= max) return null;
  return {
    startHalf: Math.max(0, rawStart),
    endHalf: Math.min(max, rawEnd),
    clippedStart: rawStart < 0,
    clippedEnd: rawEnd > max,
  };
}
