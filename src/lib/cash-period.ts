/**
 * Lógica pura del filtro de fecha de Caja (Hoy/Semana/Mes/fecha puntual) — sin
 * "server-only" ni Prisma, para poder importarse tanto desde componentes de
 * servidor (`cash.ts`, que la re-exporta) como desde el client component que
 * renderiza el selector (`cash-period-picker.tsx`).
 */
import { formatDateInput, mendozaWallTimeToUtc } from "@/lib/datetime";

/** Mes siguiente a `ym` ("YYYY-MM"), maneja el cambio de año. */
function nextMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

/** Rango [start, end) en UTC de un mes ("YYYY-MM") en hora Mendoza. */
export function monthRangeUtc(ym: string): { start: Date; end: Date } {
  return {
    start: mendozaWallTimeToUtc(`${ym}-01T00:00`),
    end: mendozaWallTimeToUtc(`${nextMonth(ym)}-01T00:00`),
  };
}

/** Fecha "YYYY-MM-DD" (hora Mendoza) desplazada `days` días. Pura. */
function addDaysYmd(ymd: string, days: number): string {
  const d = new Date(`${ymd}T12:00:00Z`); // mediodía: evita cruces de día por el offset al sumar/restar
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Día ISO de la semana de una fecha "YYYY-MM-DD" (1 = lunes ... 7 = domingo). */
function isoWeekday(ymd: string): number {
  const day = new Date(`${ymd}T12:00:00Z`).getUTCDay(); // 0 = domingo ... 6 = sábado
  return day === 0 ? 7 : day;
}

/** Lunes ("YYYY-MM-DD") de la semana que contiene `ymd`. Pura y testeable. */
export function mondayOf(ymd: string): string {
  return addDaysYmd(ymd, -(isoWeekday(ymd) - 1));
}

function formatYmdEs(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

/**
 * Filtro de fecha de la vista admin de Caja (reemplaza la navegación por mes
 * completo: con Hoy/Semana/Mes/fecha puntual alcanza, y "esta semana" puede
 * cruzar el límite de un mes, así que no tiene sentido acotarlo a un mes
 * navegable). Sólo la vista admin lo usa — el empleado sigue viendo "mis
 * movimientos de este mes" sin cambios (`getOwnCashMovements`).
 */
export type CashPeriod =
  | { kind: "today" }
  | { kind: "week" }
  | { kind: "month" }
  | { kind: "date"; date: string }; // "YYYY-MM-DD" hora Mendoza

export const DEFAULT_CASH_PERIOD: CashPeriod = { kind: "today" };

export const CASH_PERIOD_OPTIONS: { value: "today" | "week" | "month" | "date"; label: string }[] = [
  { value: "today", label: "Hoy" },
  { value: "week", label: "Esta semana" },
  { value: "month", label: "Este mes" },
  { value: "date", label: "Fecha específica" },
];

/** Parsea `?period=&date=` de la URL a un `CashPeriod`; valores desconocidos caen al default (hoy). */
export function parseCashPeriod(rawPeriod: string | undefined, rawDate: string | undefined): CashPeriod {
  if (rawPeriod === "week") return { kind: "week" };
  if (rawPeriod === "month") return { kind: "month" };
  if (rawPeriod === "date" && rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    return { kind: "date", date: rawDate };
  }
  return DEFAULT_CASH_PERIOD;
}

/** Inverso de `parseCashPeriod`: query string para links/navegación. */
export function cashPeriodSearch(period: CashPeriod): string {
  return period.kind === "date" ? `period=date&date=${period.date}` : `period=${period.kind}`;
}

/**
 * Resuelve un `CashPeriod` al rango [start, end) que filtra las queries, más
 * una etiqueta legible. Pura y testeable — recibe `now` explícito.
 */
export function resolveCashPeriod(period: CashPeriod, now: Date = new Date()): { start: Date; end: Date; label: string } {
  const todayYmd = formatDateInput(now);

  if (period.kind === "today") {
    return {
      start: mendozaWallTimeToUtc(`${todayYmd}T00:00`),
      end: mendozaWallTimeToUtc(`${addDaysYmd(todayYmd, 1)}T00:00`),
      label: "Hoy",
    };
  }
  if (period.kind === "week") {
    const monday = mondayOf(todayYmd);
    return {
      start: mendozaWallTimeToUtc(`${monday}T00:00`),
      end: mendozaWallTimeToUtc(`${addDaysYmd(monday, 7)}T00:00`),
      label: `Esta semana (${formatYmdEs(monday)} – ${formatYmdEs(addDaysYmd(monday, 6))})`,
    };
  }
  if (period.kind === "month") {
    return { ...monthRangeUtc(todayYmd.slice(0, 7)), label: "Este mes" };
  }
  return {
    start: mendozaWallTimeToUtc(`${period.date}T00:00`),
    end: mendozaWallTimeToUtc(`${addDaysYmd(period.date, 1)}T00:00`),
    label: formatYmdEs(period.date),
  };
}
