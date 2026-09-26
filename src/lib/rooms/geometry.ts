import { diffDaysKeys } from "./ical";

/**
 * Posición de una estadía en la grilla del Calendario, en MEDIAS columnas
 * desde el borde izquierdo de la ventana. La entrada cae a mediodía del día de
 * entrada y la salida a mediodía del día de salida, así una salida y una
 * entrada el mismo día quedan una al lado de la otra sin pisarse (como en un
 * calendario de hotel). Recortada a la ventana visible; `null` si no la toca.
 */
export function roomBarGeometry(
  startKey: string,
  endKey: string,
  windowStartKey: string,
  days: number,
): { startHalf: number; endHalf: number; clippedStart: boolean; clippedEnd: boolean } | null {
  const rawStart = 2 * diffDaysKeys(windowStartKey, startKey) + 1;
  const rawEnd = 2 * diffDaysKeys(windowStartKey, endKey) + 1;
  const max = 2 * days;
  if (rawEnd <= 0 || rawStart >= max) return null;
  return {
    startHalf: Math.max(0, rawStart),
    endHalf: Math.min(max, rawEnd),
    clippedStart: rawStart < 0,
    clippedEnd: rawEnd > max,
  };
}
