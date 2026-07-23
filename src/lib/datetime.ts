/**
 * Date/time helpers for Andes.
 *
 * Rule (PROYECTO-ANDES.md §7): store everything in UTC, display in Mendoza
 * local time. All formatting for the UI, PDFs and emails must go through these
 * helpers so we never leak a server-timezone-dependent string.
 */

export const APP_TIME_ZONE = "America/Argentina/Mendoza";

const LOCALE_TAG: Record<"es" | "en", string> = {
  es: "es-AR",
  en: "en-US",
};

/** Formats an instant as a Mendoza-local date+time string (e.g. "10/07/2026 14:35"). */
export function formatDateTime(
  date: Date,
  locale: "es" | "en" = "es",
): string {
  return new Intl.DateTimeFormat(LOCALE_TAG[locale], {
    timeZone: APP_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

/** Formats an instant as "YYYY-MM-DD" in Mendoza local time (para inputs date). */
export function formatDateInput(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Formats an instant as "YYYY-MM-DDTHH:mm" in Mendoza local time (para inputs
 * `datetime-local`). Es el inverso de `mendozaWallTimeToUtc`.
 */
export function formatDateTimeInput(date: Date): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: APP_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .filter((x) => x.type !== "literal")
      .map((x) => [x.type, x.value]),
  ) as Record<string, string>;
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** Formats an instant as a Mendoza-local time string (e.g. "14:35"), no date. */
export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

/** Formats an instant as a Mendoza-local date string (no time). */
export function formatDate(date: Date, locale: "es" | "en" = "es"): string {
  return new Intl.DateTimeFormat(LOCALE_TAG[locale], {
    timeZone: APP_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

/**
 * Converts a VikRentCar Unix timestamp (seconds since epoch) into a JS Date,
 * treating it as an *absolute* epoch instant. Kept for callers that already
 * hold a true UTC epoch; para las fechas de reserva usar
 * `vikRentCarUnixToUtc` (VikRentCar guarda hora de pared local, no UTC).
 */
export function fromUnixSeconds(seconds: number): Date {
  return new Date(seconds * 1000);
}

/**
 * Interpreta un timestamp `ritiro`/`consegna` de VikRentCar como el instante UTC
 * correcto. Con WordPress en `gmt_offset=-3` (Mendoza, sin `timezone_string`),
 * VikRentCar guarda la **hora de pared local** como Unix segundos, sin convertir
 * a UTC: p.ej. una reserva a las 12:00 de Mendoza queda como el epoch de
 * "12:00Z". Sin esta corrección, mostrar en Mendoza restaría 3h de más (12:00 →
 * 09:00). Reinterpretamos esos componentes como hora de pared de Mendoza y
 * devolvemos el instante UTC real. Ver docs/wordpress-mapping.md.
 */
export function vikRentCarUnixToUtc(seconds: number): Date {
  const wallAsUtc = new Date(seconds * 1000);
  const offsetMs = tzOffsetMs(wallAsUtc, APP_TIME_ZONE);
  return new Date(wallAsUtc.getTime() - offsetMs);
}

/** Offset (tz − UTC) en ms para un instante dado, calculado vía Intl. */
function tzOffsetMs(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p = Object.fromEntries(
    dtf
      .formatToParts(date)
      .filter((x) => x.type !== "literal")
      .map((x) => [x.type, Number(x.value)]),
  ) as Record<string, number>;
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - date.getTime();
}

/**
 * Interpreta un string de `datetime-local` ("YYYY-MM-DDTHH:mm") como hora de
 * pared en Mendoza y devuelve el instante UTC correspondiente. Guardar en UTC,
 * mostrar en local (PROYECTO-ANDES.md §7).
 */
export function mendozaWallTimeToUtc(wall: string): Date {
  const naiveUtc = new Date(`${wall}:00Z`);
  const offsetMs = tzOffsetMs(naiveUtc, APP_TIME_ZONE);
  return new Date(naiveUtc.getTime() - offsetMs);
}
