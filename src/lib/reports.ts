import "server-only";

/**
 * Analítica histórica para el dashboard de reportes (admin). El dashboard de la
 * home es operativo del día; esto es la mirada histórica: ingresos vs costos,
 * daños por vehículo y actividad por mes.
 *
 * Los ingresos salen del contrato del empleado (`Rental.pricing.total`), con
 * fallback al total importado de VikRentCar (`bookingTotal`). Sólo se cuentan
 * alquileres **finalizados** (los reservados por el sync no tienen contrato).
 * Cortes de mes en hora de Mendoza. Ver PROYECTO-ANDES.md §4.3–4.4.
 */
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { formatDateInput, mendozaWallTimeToUtc } from "@/lib/datetime";
import type { ContractPricing } from "@/lib/contract";

export type MonthPoint = { month: string; rentals: number; km: number };

export type VehicleReport = {
  id: string;
  label: string;
  plate: string;
  rentals: number;
  income: number;
  cost: number;
  net: number;
  damages: number;
  archived: boolean;
};

export type Reports = {
  kpis: {
    fleet: number;
    rentedNow: number;
    finished: number;
    active: number;
    incomeTotal: number;
    costTotal: number;
    netTotal: number;
  };
  byMonth: MonthPoint[];
  vehicles: VehicleReport[];
};

/** Año-mes ("YYYY-MM") de un instante, en hora de Mendoza. */
function monthOf(date: Date): string {
  return formatDateInput(date).slice(0, 7);
}

/**
 * `count` meses hasta `currentYm` (inclusive), del más viejo al actual, como
 * "YYYY-MM". Pura y testeable (maneja el cambio de año). Ej.
 * recentMonths("2026-02", 3) → ["2025-12", "2026-01", "2026-02"].
 */
export function recentMonths(currentYm: string, count: number): string[] {
  const [y0, m0] = currentYm.split("-").map(Number);
  const months: string[] = [];
  let y = y0;
  let m = m0;
  for (let i = 0; i < count; i++) {
    months.unshift(`${y}-${String(m).padStart(2, "0")}`);
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return months;
}

/** Rangos de "últimos N meses" disponibles, además de los meses puntuales. */
export const MONTH_RANGE_OPTIONS = [3, 6, 12, 24] as const;
export type MonthRangeOption = (typeof MONTH_RANGE_OPTIONS)[number];

/**
 * Período que filtra **todo** el reporte (KPIs de flujo, tabla "por
 * vehículo" y gráfico "por mes") — no solo el gráfico. Los KPIs de estado
 * actual (flota, alquilados ahora, activos) y los daños activos por vehículo
 * quedan fuera de este filtro a propósito: son una foto de "ahora", no un
 * acumulado del período (no tendría sentido preguntar "cuántos autos tenía
 * mi flota en julio").
 */
export type ReportPeriod =
  | { kind: "month"; which: "previous" | "current" }
  | { kind: "months"; months: MonthRangeOption };

/** Mes anterior (cerrado): es lo que un dueño quiere ver al entrar a hacer el cierre del mes. */
export const DEFAULT_REPORT_PERIOD: ReportPeriod = { kind: "month", which: "previous" };

const REPORT_PERIOD_PARAMS = { previous: "prev", current: "current" } as const;

export const REPORT_PERIOD_OPTIONS: { param: string; label: string }[] = [
  { param: REPORT_PERIOD_PARAMS.previous, label: "Mes anterior" },
  { param: REPORT_PERIOD_PARAMS.current, label: "Este mes" },
  ...MONTH_RANGE_OPTIONS.map((m) => ({ param: String(m), label: `Últimos ${m} meses` })),
];

/** Parsea el `?period=` de la URL a un `ReportPeriod`; cualquier valor desconocido cae al default. */
export function parseReportPeriod(raw: string | undefined): ReportPeriod {
  if (raw === REPORT_PERIOD_PARAMS.current) return { kind: "month", which: "current" };
  if (raw === REPORT_PERIOD_PARAMS.previous) return DEFAULT_REPORT_PERIOD;
  const months = MONTH_RANGE_OPTIONS.find((m) => String(m) === raw);
  return months ? { kind: "months", months } : DEFAULT_REPORT_PERIOD;
}

/** Inverso de `parseReportPeriod`: arma el valor de `?period=` para links/selects. */
export function reportPeriodParam(period: ReportPeriod): string {
  return period.kind === "months" ? String(period.months) : REPORT_PERIOD_PARAMS[period.which];
}

const MONTH_NAMES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** Etiqueta legible del período elegido, para mostrar arriba de los KPIs. */
export function reportPeriodLabel(period: ReportPeriod, now: Date = new Date()): string {
  if (period.kind === "months") return `Últimos ${period.months} meses`;
  const [y, m] = resolveReportPeriod(period, now).monthList[0].split("-").map(Number);
  const suffix = period.which === "current" ? " (en curso)" : "";
  return `${MONTH_NAMES_ES[m - 1]} de ${y}${suffix}`;
}

/** Primer instante (00:00 hora Mendoza) del mes "YYYY-MM", como UTC. */
function monthStartUtc(ym: string): Date {
  return mendozaWallTimeToUtc(`${ym}-01T00:00`);
}

/**
 * Resuelve un `ReportPeriod` al rango [start, end) que filtra las queries, más
 * la lista de meses que arma el gráfico "por mes". Pura y testeable — recibe
 * `now` explícito en vez de leer el reloj.
 */
export function resolveReportPeriod(
  period: ReportPeriod,
  now: Date = new Date(),
): { start: Date; end: Date; monthList: string[] } {
  const currentYm = monthOf(now);
  if (period.kind === "month") {
    if (period.which === "current") {
      return { start: monthStartUtc(currentYm), end: now, monthList: [currentYm] };
    }
    const previousYm = recentMonths(currentYm, 2)[0];
    return { start: monthStartUtc(previousYm), end: monthStartUtc(currentYm), monthList: [previousYm] };
  }
  const monthList = recentMonths(currentYm, period.months);
  return { start: monthStartUtc(monthList[0]), end: now, monthList };
}

export type VehicleSortKey = "rentals" | "income" | "cost" | "net" | "damages";
export const DEFAULT_VEHICLE_SORT: VehicleSortKey = "income";

/**
 * Reordena la tabla "por vehículo" por la columna elegida (click en el
 * encabezado, ver reports/page.tsx). No muta el array de entrada.
 */
export function sortVehicleReports(
  vehicles: VehicleReport[],
  sort: VehicleSortKey,
  dir: "asc" | "desc",
): VehicleReport[] {
  const mul = dir === "asc" ? 1 : -1;
  return [...vehicles].sort((a, b) => mul * (a[sort] - b[sort]) || b.income - a.income);
}

/**
 * Reportes es analítica histórica de solo lectura (admin), no parte del flujo
 * operativo del día — a diferencia del dashboard (getDashboardData), acá
 * tolera quedar hasta 1 minuto desatualizado a cambio de no recalcular estas
 * agregaciones en cada carga de página y en cada export CSV. Sin
 * invalidación por tag: no vale la complejidad de engancharse a
 * saveHandover/saveReturn/mantenimiento solo para bajar de 60s a instantáneo
 * en una pantalla de admin que no se mira en tiempo real.
 */
export const getReports = unstable_cache(
  async (period: ReportPeriod = DEFAULT_REPORT_PERIOD): Promise<Reports> => {
    const { start, end, monthList } = resolveReportPeriod(period);

    const [vehicles, finished, maintenanceByVehicle, damages, activeCount] = await Promise.all([
      // Sin filtrar archivados: un vehículo archivado sigue arrastrando su
      // historial de ingresos/costos, y si se lo excluyera acá el total de la
      // tabla "por vehículo" dejaría de reconciliar contra el KPI de arriba
      // (que sí suma todo lo finalizado del período, haya o no vehículo
      // archivado después).
      prisma.vehicle.findMany({
        select: { id: true, plate: true, brand: true, model: true, status: true, archivedAt: true },
      }),
      // Acotado al período elegido (mes anterior por defecto): el ingreso sale
      // de un campo Json (`pricing`, con fallback a `bookingTotal`) que no se
      // puede sumar a nivel base de datos — hace falta traer cada alquiler
      // finalizado del período para resolverlo en JS.
      prisma.rental.findMany({
        where: { status: "finished", endAt: { gte: start, lt: end } },
        select: {
          id: true,
          vehicleId: true,
          pricing: true,
          bookingTotal: true,
          endAt: true,
          inspections: { select: { type: true, km: true } },
        },
      }),
      // Agregado en la base (una fila por vehículo) en vez de traer cada
      // registro de mantenimiento — a diferencia de `finished`, acá sí se
      // puede sumar en SQL porque `cost` es una columna numérica simple.
      // También acotado al período: es un costo del mes, no un acumulado.
      prisma.maintenanceLog.groupBy({
        by: ["vehicleId"],
        where: { date: { gte: start, lt: end } },
        _sum: { cost: true },
      }),
      // Daños activos = estado actual del auto (sin reparar ahora), no un
      // evento del período — no se acota por fecha a propósito.
      prisma.damage.groupBy({
        by: ["vehicleId"],
        where: { repaired: false },
        _count: { _all: true },
      }),
      prisma.rental.count({ where: { status: "active" } }),
    ]);

    const vMap = new Map<string, VehicleReport>(
      vehicles.map((v) => [
        v.id,
        {
          id: v.id,
          label: `${v.brand} ${v.model}`,
          plate: v.plate,
          rentals: 0,
          income: 0,
          cost: 0,
          net: 0,
          damages: 0,
          archived: v.archivedAt != null,
        },
      ]),
    );

    const monthMap = new Map<string, MonthPoint>(monthList.map((m) => [m, { month: m, rentals: 0, km: 0 }]));

    let incomeTotal = 0;
    for (const r of finished) {
      const pricing = (r.pricing ?? {}) as ContractPricing;
      const income = pricing.total ?? (r.bookingTotal ? Number(r.bookingTotal) : 0);
      incomeTotal += income;

      const handover = r.inspections.find((i) => i.type === "handover");
      const ret = r.inspections.find((i) => i.type === "return_");
      const kmDriven = handover && ret ? Math.max(0, ret.km - handover.km) : 0;

      const v = r.vehicleId ? vMap.get(r.vehicleId) : undefined;
      if (v) {
        v.rentals += 1;
        v.income += income;
      }

      const bucket = monthMap.get(monthOf(r.endAt));
      if (bucket) {
        bucket.rentals += 1;
        bucket.km += kmDriven;
      }
    }

    let costTotal = 0;
    for (const m of maintenanceByVehicle) {
      const cost = m._sum.cost ? Number(m._sum.cost) : 0;
      costTotal += cost;
      const v = vMap.get(m.vehicleId);
      if (v) v.cost = cost;
    }

    for (const d of damages) {
      const v = vMap.get(d.vehicleId);
      if (v) v.damages = d._count._all;
    }

    const vehicleReports = [...vMap.values()]
      .map((v) => ({ ...v, net: v.income - v.cost }))
      .sort((a, b) => b.income - a.income || b.rentals - a.rentals);

    return {
      kpis: {
        fleet: vehicles.filter((v) => v.archivedAt == null).length,
        rentedNow: vehicles.filter((v) => v.status === "rented").length,
        finished: finished.length,
        active: activeCount,
        incomeTotal,
        costTotal,
        netTotal: incomeTotal - costTotal,
      },
      byMonth: monthList.map((m) => monthMap.get(m)!),
      vehicles: vehicleReports,
    };
  },
  ["reports"],
  { revalidate: 60, tags: ["reports"] },
);
