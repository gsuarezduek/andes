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

/** Mes anterior a `ym` ("YYYY-MM"), maneja el cambio de año. */
function previousMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

const MONTH_FORMATTER = new Intl.DateTimeFormat("es-AR", { month: "long", timeZone: "America/Argentina/Mendoza" });

/** Nombre del mes en español, capitalizado (ej. "Julio"). */
function monthName(ym: string): string {
  const label = MONTH_FORMATTER.format(mendozaWallTimeToUtc(`${ym}-15T12:00`));
  return label.charAt(0).toUpperCase() + label.slice(1);
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
 * completo: con Hoy/Semana/Mes/rango de fechas alcanza, y "esta semana" puede
 * cruzar el límite de un mes, así que no tiene sentido acotarlo a un mes
 * navegable). Sólo la vista admin lo usa — el empleado sigue viendo "mis
 * movimientos de este mes" sin cambios (`getOwnCashMovements`).
 */
export type CashPeriod =
  | { kind: "today" }
  | { kind: "week" }
  | { kind: "month" }
  | { kind: "previous_month" }
  // Rango de fechas ("YYYY-MM-DD" hora Mendoza, ambos inclusive). Un solo
  // día es un caso particular con from === to.
  | { kind: "date"; from: string; to: string };

export const DEFAULT_CASH_PERIOD: CashPeriod = { kind: "today" };

export const CASH_PERIOD_OPTIONS: { value: "today" | "week" | "month" | "previous_month" | "date"; label: string }[] = [
  { value: "today", label: "Hoy" },
  { value: "week", label: "Esta semana" },
  { value: "month", label: "Este mes" },
  { value: "previous_month", label: "Mes anterior" },
  { value: "date", label: "Rango de fechas" },
];

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Parsea `?period=&from=&to=` de la URL a un `CashPeriod`; valores desconocidos caen al default (hoy). */
export function parseCashPeriod(
  rawPeriod: string | undefined,
  rawFrom: string | undefined,
  rawTo?: string | undefined,
): CashPeriod {
  if (rawPeriod === "week") return { kind: "week" };
  if (rawPeriod === "month") return { kind: "month" };
  if (rawPeriod === "previous_month") return { kind: "previous_month" };
  if (rawPeriod === "date" && rawFrom && YMD_RE.test(rawFrom)) {
    const to = rawTo && YMD_RE.test(rawTo) ? rawTo : rawFrom;
    // Si "hasta" quedó antes que "desde" (fechas invertidas a mano en la URL),
    // se toma "desde" como los dos extremos en vez de armar un rango vacío/negativo.
    return { kind: "date", from: rawFrom, to: to < rawFrom ? rawFrom : to };
  }
  return DEFAULT_CASH_PERIOD;
}

/** Inverso de `parseCashPeriod`: query string para links/navegación. */
export function cashPeriodSearch(period: CashPeriod): string {
  return period.kind === "date" ? `period=date&from=${period.from}&to=${period.to}` : `period=${period.kind}`;
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
  if (period.kind === "previous_month") {
    const prevYm = previousMonth(todayYmd.slice(0, 7));
    return { ...monthRangeUtc(prevYm), label: `Mes anterior (${monthName(prevYm)})` };
  }
  return {
    start: mendozaWallTimeToUtc(`${period.from}T00:00`),
    end: mendozaWallTimeToUtc(`${addDaysYmd(period.to, 1)}T00:00`),
    label:
      period.from === period.to
        ? formatYmdEs(period.from)
        : `${formatYmdEs(period.from)} – ${formatYmdEs(period.to)}`,
  };
}
