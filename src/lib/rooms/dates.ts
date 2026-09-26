/**
 * Fechas de calendario de las habitaciones. Se guardan como `DATE` (sin hora ni
 * zona), así que se manejan siempre como "YYYY-MM-DD" para no arrastrar
 * corrimientos de zona horaria.
 */

/** "YYYY-MM-DD" → Date a medianoche UTC (lo que Prisma espera para un `@db.Date`). */
export function keyToDate(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

/** Date de un `@db.Date` → "YYYY-MM-DD". */
export function dateToKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function isDateKey(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = keyToDate(v);
  return !Number.isNaN(d.getTime()) && dateToKey(d) === v;
}

/** Noches de una estadía (salida − entrada). */
export function nightsBetween(startKey: string, endKey: string): number {
  return Math.round((keyToDate(endKey).getTime() - keyToDate(startKey).getTime()) / 86_400_000);
}

/** ¿Se pisan dos estadías? La salida de una y la entrada de la otra el mismo día NO cuenta. */
export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}
