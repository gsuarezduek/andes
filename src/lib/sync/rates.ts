/**
 * Cálculo de la tarifa por día del auto a partir de los datos de VikRentCar.
 * Lógica pura (sin DB) para testearla y compartirla. Ver docs/wordpress-mapping.md.
 *
 * Tarifa vigente = base(1 día) × ∏(1 + %/100) de las temporadas activas hoy que
 * apliquen a ese modelo. Las temporadas guardan `from`/`to` como segundos dentro
 * del año (día del año × 86400) y opcionalmente fijan un `year`.
 */
import { APP_TIME_ZONE, mendozaWallTimeToUtc, formatDateInput } from "@/lib/datetime";
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

/** Ventana mínima de una temporada para chequear vigencia / convertir a fechas. */
type SeasonWindow = { from: number; to: number; year: number | null };

/** Resultado de evaluar una temporada en un día puntual. */
type SeasonMatch = { active: boolean; fromYear: number };

/**
 * ¿Está vigente `season` el día `now`? Si `season.to < season.from`, la
 * temporada **cruza fin de año** (ej. 1-dic a 31-ene: `from` ≈ día 335,
 * `to` ≈ día 31, un valor menor) — vigente tanto en su "cola" (diciembre,
 * mismo año que `now`) como en su "cabeza" (enero, el año siguiente al de
 * `from`). `fromYear` siempre identifica el año de `from` (el año "de
 * arranque" de esa ocurrencia), aunque `now` caiga del lado de enero.
 */
function matchSeason(season: SeasonWindow, now: Date): SeasonMatch {
  const { year, seconds } = secondsIntoYear(now);
  if (season.from <= season.to) {
    const active =
      (season.year == null || season.year === year) && seconds >= season.from && seconds <= season.to;
    return { active, fromYear: year };
  }
  // Cruza fin de año: `now` cae en la cola (diciembre) o en la cabeza (enero).
  if (seconds >= season.from) {
    return { active: season.year == null || season.year === year, fromYear: year };
  }
  if (seconds <= season.to) {
    const fromYear = year - 1;
    return { active: season.year == null || season.year === fromYear, fromYear };
  }
  return { active: false, fromYear: year };
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
  let multiplier = 1;
  for (const s of seasons) {
    if (!s.idcars.includes(idcar)) continue;
    if (!matchSeason({ from: s.from, to: s.to, year: s.year }, now).active) continue;
    multiplier *= 1 + s.diffPercent / 100;
  }
  return Math.round(base * multiplier);
}

/** ¿Está vigente `season` el día `now` (cualquier año si `season.year` es null)? */
export function isSeasonActiveOn(season: SeasonWindow, now: Date): boolean {
  return matchSeason(season, now).active;
}

/**
 * Año de inicio (`from`) de la vigencia de `season` el día `now`, o `null` si
 * no está vigente ese día — el "año ancla" correcto para pasarle a
 * `seasonDateRange`, incluso cuando `now` cae del lado de enero de una
 * temporada que cruza fin de año (ahí el año de `now` es el de `to`, uno más
 * que el de `from`).
 */
export function seasonFromYear(season: SeasonWindow, now: Date): number | null {
  const match = matchSeason(season, now);
  return match.active ? match.fromYear : null;
}

/**
 * Traduce el rango `from`/`to` (segundos dentro del año) de una temporada a
 * fechas calendario reales ("YYYY-MM-DD", hora de Mendoza), a partir del año
 * de `from` (`year`) — el inverso de `secondsIntoYear`. Como `from`/`to` son
 * siempre límites de día completo, sumar los segundos a la medianoche del 1°
 * de enero cae directo en el día correcto (sin lidiar con años bisiestos a
 * mano: el propio avance de fechas ya contempla el 29 de febrero). Si
 * `to < from` (cruza fin de año), `to` se cuenta desde el 1° de enero del año
 * SIGUIENTE a `year`.
 */
export function seasonDateRange(
  season: Pick<SeasonWindow, "from" | "to">,
  year: number,
): { start: string; end: string } {
  const jan1 = mendozaWallTimeToUtc(`${year}-01-01T00:00`);
  const start = formatDateInput(new Date(jan1.getTime() + season.from * 1000));
  const wraps = season.to < season.from;
  const endJan1 = wraps ? mendozaWallTimeToUtc(`${year + 1}-01-01T00:00`) : jan1;
  const end = formatDateInput(new Date(endJan1.getTime() + season.to * 1000));
  return { start, end };
}
