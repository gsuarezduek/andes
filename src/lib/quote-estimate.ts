/**
 * Sugerido de total para un presupuesto del Calendario. Pura y sin
 * `server-only` a propósito: se usa desde el Client Component del Calendario
 * para calcular el sugerido al instante (sin ida y vuelta al servidor)
 * apenas se completa la selección de días — un archivo con `server-only`
 * bloquea el import completo desde un componente cliente, incluso de una
 * función pura (mismo gotcha ya documentado en v28 de CLAUDE.md).
 *
 * `Vehicle.dailyRate` es la tarifa de HOY (el sync ya le aplica el % de
 * temporada vigente hoy, ver `computeDailyRate` en src/lib/sync/rates.ts) —
 * no un precio fijo. Un presupuesto que cruza una suba de temporada (ej. 2
 * días, el segundo con +10%) no puede cobrar los dos días al precio de hoy:
 * hay que "des-aplicar" el multiplicador de hoy para reconstruir la tarifa
 * base y volver a aplicar, día por día, la temporada vigente ESE día.
 */
export type SeasonDiff = { diffPercent: number };

/** Multiplicador de un día a partir de sus temporadas activas — mismo
 *  criterio que el sync: producto de (1 + %/100) de cada una (por si algún
 *  día llega a tener más de una superpuesta). Sin temporadas, 1 (sin cambio). */
function seasonMultiplier(seasons: SeasonDiff[]): number {
  return seasons.reduce((acc, s) => acc * (1 + s.diffPercent / 100), 1);
}

/**
 * `todaySeasons`: temporadas vigentes hoy (para reconstruir la tarifa base a
 * partir de `dailyRate`). `daySeasonsByDay`: una entrada por cada día
 * seleccionado del presupuesto, con las temporadas vigentes ESE día.
 */
export function estimateQuoteTotal(
  dailyRate: number | null,
  todaySeasons: SeasonDiff[],
  daySeasonsByDay: SeasonDiff[][],
): number | null {
  if (dailyRate == null || daySeasonsByDay.length === 0) return null;
  const todayMultiplier = seasonMultiplier(todaySeasons);
  if (todayMultiplier <= 0) return null; // guard teórico, no debería pasar
  const baseRate = dailyRate / todayMultiplier;
  const total = daySeasonsByDay.reduce((sum, seasons) => sum + baseRate * seasonMultiplier(seasons), 0);
  return Math.round(total);
}

/** Precio por día = total ÷ días, redondeado a peso entero. `null` si falta
 *  el total o no es un número válido, o si los días no son positivos. Se
 *  calcula sobre el total que esté cargado (sugerido o editado a mano), no
 *  sobre la tarifa: es lo que se le dice al cliente. */
export function quotePricePerDay(total: number | null, days: number): number | null {
  if (total == null || Number.isNaN(total) || total <= 0 || days <= 0) return null;
  return Math.round(total / days);
}
