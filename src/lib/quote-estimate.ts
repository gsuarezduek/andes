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
import { formatDateInput, formatTime, mendozaWallTimeToUtc } from "@/lib/datetime";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

/** `true` si el instante cae exactamente a medianoche Mendoza de su propio
 *  día — es la forma de distinguir "sin horario cargado" (medianoche, el
 *  criterio de siempre) de un horario real sin guardar un flag aparte. */
function isMendozaMidnight(d: Date): boolean {
  return mendozaWallTimeToUtc(`${formatDateInput(d)}T00:00`).getTime() === d.getTime();
}

/**
 * Rango real [retiro, devolución) de un presupuesto a partir del primer y
 * último día elegido en la grilla del Calendario (`startDayKey`/`endDayKey`,
 * "YYYY-MM-DD", inclusive) y, opcionalmente, los horarios de retiro y
 * devolución — para poder facturar 1 día en vez de 2 cuando la devolución
 * es dentro de las 24hs del retiro (ej. retiro hoy 9am, vuelve mañana 9am).
 *
 * Sin horario en alguno de los dos extremos (`null`/vacío), ese extremo cae
 * al criterio de siempre — el día entero: retiro a medianoche del primer
 * día, devolución a medianoche del día SIGUIENTE al último — así cargar un
 * solo horario no "achica" por accidente los días ya elegidos en la grilla
 * (el auto sigue bloqueado el día entero de devolución si no se aclaró a
 * qué hora vuelve).
 */
export function buildQuoteRange(
  startDayKey: string,
  endDayKey: string,
  pickupTime: string | null,
  returnTime: string | null,
): { startAt: Date; endAt: Date } {
  const startAt = mendozaWallTimeToUtc(`${startDayKey}T${pickupTime || "00:00"}`);
  const endAt = returnTime
    ? mendozaWallTimeToUtc(`${endDayKey}T${returnTime}`)
    : new Date(mendozaWallTimeToUtc(`${endDayKey}T00:00`).getTime() + MS_PER_DAY);
  return { startAt, endAt };
}

/** Días de facturación entre retiro y devolución, redondeado hacia arriba —
 *  un día empezado cuenta entero, mismo criterio que `extensionExtraDays`
 *  (extensión de un alquiler ya entregado, `src/lib/rental-extension.ts`).
 *  Sin horarios cargados coincide con la cantidad de días de calendario
 *  elegidos en la grilla. Nunca menos de 1. */
export function quoteBillableDays(startAt: Date, endAt: Date): number {
  const diff = endAt.getTime() - startAt.getTime();
  return Math.max(1, Math.ceil(diff / MS_PER_DAY));
}

/** Inversa de `buildQuoteRange`: recupera el día/horario de retiro y
 *  devolución tal como se cargaron (o "sin horario" si cae justo a
 *  medianoche), para prellenar el formulario de edición de un presupuesto
 *  ya guardado. */
export function splitQuoteRange(
  startAt: Date,
  endAt: Date,
): { startDayKey: string; endDayKey: string; pickupTime: string; returnTime: string } {
  const startDayKey = formatDateInput(startAt);
  const pickupTime = isMendozaMidnight(startAt) ? "" : formatTime(startAt);
  const endIsMidnight = isMendozaMidnight(endAt);
  const endDayKey = endIsMidnight ? formatDateInput(new Date(endAt.getTime() - MS_PER_DAY)) : formatDateInput(endAt);
  const returnTime = endIsMidnight ? "" : formatTime(endAt);
  return { startDayKey, endDayKey, pickupTime, returnTime };
}
