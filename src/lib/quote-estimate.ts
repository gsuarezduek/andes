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

/** A partir de este resto de horas sobre los días completos, conviene cobrar
 *  directamente el día entero en vez de seguir sumando por hora extra — con
 *  el 20% por hora que se usa hoy, 5 horas ya igualan el 100% de un día. */
const EXTRA_HOUR_DAY_THRESHOLD = 5;

export type QuoteDaysBreakdown = {
  /** Días completos de 24hs (nunca menos de 1). */
  days: number;
  /** Horas del resto que se cobran aparte como "hora extra" — 0 si no hay
   *  resto, o si el resto ya se redondeó a un día completo por superar
   *  `EXTRA_HOUR_DAY_THRESHOLD`. */
  extraHours: number;
};

/**
 * Desglose de días/horas de un rango real [retiro, devolución) — reemplaza
 * el criterio viejo de "redondear siempre hacia arriba a día completo" por
 * "día + hora extra", el mismo que ya usa la hora extra del contrato real
 * (`extraHourAmount` en `contract.ts`, % de la tarifa diaria configurado en
 * Condiciones). Ejemplo: retiro hoy 9am, devolución mañana 9am = 1 día
 * exacto (antes daba 2, porque esas son las columnas de calendario que hay
 * que bloquear, no los días facturables).
 */
export function quoteDaysBreakdown(startAt: Date, endAt: Date): QuoteDaysBreakdown {
  // Redondeado al minuto: evita que un resto de milisegundos (ej. por cómo
  // se arman los `Date`) cuente como si hubiera una hora extra real.
  const diffHours = Math.max(0, Math.round((endAt.getTime() - startAt.getTime()) / 60_000) / 60);
  if (diffHours <= 24) return { days: 1, extraHours: 0 };
  const fullDays = Math.floor(diffHours / 24);
  const restHours = diffHours - fullDays * 24;
  if (restHours < 1 / 60) return { days: fullDays, extraHours: 0 };
  if (restHours >= EXTRA_HOUR_DAY_THRESHOLD) return { days: fullDays + 1, extraHours: 0 };
  return { days: fullDays, extraHours: restHours };
}

/** Días a efectos de mostrar/dividir en un número entero (mensaje de
 *  WhatsApp, vista de solo lectura del detalle): el resto de horas extra, si
 *  lo hay, se redondea hacia arriba a un día más. Para el desglose real en
 *  pesos (día + % de hora extra) usar `quoteDaysBreakdown` + `estimateQuoteTotal`. */
export function quoteBillableDays(startAt: Date, endAt: Date): number {
  const { days, extraHours } = quoteDaysBreakdown(startAt, endAt);
  return extraHours > 0 ? days + 1 : days;
}

/**
 * `todaySeasons`: temporadas vigentes hoy (para reconstruir la tarifa base a
 * partir de `dailyRate`). `daySeasonsByDay`: una entrada por cada día de
 * CALENDARIO seleccionado del presupuesto (no por día facturable), con las
 * temporadas vigentes ese día — los primeros `breakdown.days` se cobran
 * enteros; el resto de horas (`breakdown.extraHours`), si lo hay, se cobra
 * como `extraHourPercent`% de la tarifa del día siguiente a esos días
 * completos (el día en que cae la devolución real).
 *
 * `extraHourPercent` null (sin configurar en Condiciones) → cualquier resto
 * de horas se cobra como un día completo más, igual que el criterio viejo —
 * no se regala tiempo sin cobrar por falta de configuración.
 */
export type QuoteEstimate = {
  /** Total sugerido (redondeado), ya incluye `extraAmount`. */
  total: number;
  /** Importe de las horas extra incluido en `total` — 0 si no hay resto, o
   *  si no hay `extraHourPercent` configurado (ahí el resto se cobra como
   *  un día completo más, dentro de `total`, no como importe aparte). */
  extraAmount: number;
};

export function estimateQuoteTotal(
  dailyRate: number | null,
  todaySeasons: SeasonDiff[],
  daySeasonsByDay: SeasonDiff[][],
  breakdown: QuoteDaysBreakdown,
  extraHourPercent: number | null,
): QuoteEstimate | null {
  if (dailyRate == null || daySeasonsByDay.length === 0) return null;
  const todayMultiplier = seasonMultiplier(todaySeasons);
  if (todayMultiplier <= 0) return null; // guard teórico, no debería pasar
  const baseRate = dailyRate / todayMultiplier;

  const hasExtraCharge = extraHourPercent != null && breakdown.extraHours > 0;
  const fullDays = breakdown.extraHours > 0 && !hasExtraCharge ? breakdown.days + 1 : breakdown.days;

  let daysTotal = 0;
  for (let i = 0; i < fullDays; i++) {
    daysTotal += baseRate * seasonMultiplier(daySeasonsByDay[i] ?? []);
  }

  let extraAmount = 0;
  if (hasExtraCharge) {
    const extraDaySeasons = daySeasonsByDay[breakdown.days] ?? daySeasonsByDay[daySeasonsByDay.length - 1] ?? [];
    extraAmount = baseRate * seasonMultiplier(extraDaySeasons) * (extraHourPercent! / 100) * breakdown.extraHours;
  }

  return { total: Math.round(daysTotal + extraAmount), extraAmount: Math.round(extraAmount) };
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
