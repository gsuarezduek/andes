/**
 * Cálculo de la tarifa por día del auto a partir de los datos de VikRentCar.
 * Lógica pura (sin DB) para testearla y compartirla. Ver docs/wordpress-mapping.md.
 *
 * Tarifa vigente = base(1 día) × ∏(1 + %/100) de las temporadas activas hoy que
 * apliquen a ese modelo. Las temporadas guardan `from`/`to` como segundos dentro
 * del año (día del año × 86400) y opcionalmente fijan un `year`.
 */
import { APP_TIME_ZONE } from "@/lib/datetime";
import type { RawSeason } from "./types";

/** Parsea el formato de VikRentCar `-8-,-25-,-5-,` → [8, 25, 5]. */
export function parseIdCars(raw: string | null): number[] {
  if (!raw) return [];
  return Array.from(raw.matchAll(/-(\d+)-/g), (m) => Number(m[1]));
}

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** Día del año (1 = 1 de enero) para una fecha Y/M/D. */
function dayOfYear(y: number, m: number, d: number): number {
  const days = [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let doy = d;
  for (let i = 0; i < m - 1; i++) doy += days[i];
  return doy;
}

/**
 * Año y "segundos dentro del año" de un instante, en hora de Mendoza. Espeja
 * cómo VikRentCar codifica los rangos de temporada: (díaDelAño − 1) × 86400.
 */
export function secondsIntoYear(now: Date): { year: number; seconds: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const year = get("year");
  const seconds = (dayOfYear(year, get("month"), get("day")) - 1) * 86_400;
  return { year, seconds };
}

/**
 * Tarifa por 1 día vigente hoy para un modelo (`idcar`). `null` si no hay tarifa
 * base cargada. Aplica las temporadas activas que incluyan el modelo.
 */
export function computeDailyRate(
  base: number | null,
  seasons: RawSeason[],
  idcar: number,
  now: Date,
): number | null {
  if (base == null || !Number.isFinite(base)) return null;
  const { year, seconds } = secondsIntoYear(now);
  let multiplier = 1;
  for (const s of seasons) {
    if (s.year != null && s.year !== year) continue;
    if (seconds < s.from || seconds > s.to) continue;
    if (!s.idcars.includes(idcar)) continue;
    multiplier *= 1 + s.diffPercent / 100;
  }
  return Math.round(base * multiplier);
}
