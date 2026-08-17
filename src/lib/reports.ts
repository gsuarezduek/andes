import "server-only";

/**
 * Analítica histórica para el dashboard de reportes (admin). El dashboard de la
 * home es operativo del día; esto es la mirada histórica: ingresos vs costos,
 * daños por vehículo y actividad por mes.
 *
 * Los KPIs de "Ingresos"/"Egresos"/"Neto" salen de los movimientos REALES de
 * Caja del período (`CashMovement`, dinero que efectivamente entró/salió) —
 * no del contrato de la reserva. La tabla "por vehículo" sigue usando el
 * contrato del empleado (`Rental.pricing.total`, con fallback a
 * `bookingTotal`) porque necesita atribuir un ingreso a un auto puntual, y
 * Caja no siempre tiene esa atribución (hay egresos/ingresos sin reserva
 * vinculada — sueldos, gastos generales). Por eso el total de "Ingresos" de
 * los KPIs y la suma de la columna "Ingresos" de la tabla no van a coincidir
 * a propósito: miden cosas distintas (flujo de caja real vs. facturación por
 * alquiler). Sólo se cuentan alquileres **finalizados** en la tabla. Cortes
 * de mes en hora de Mendoza. Ver PROYECTO-ANDES.md §4.3–4.4.
 */
import { unstable_cache } from "next/cache";
import type { PaymentMethodOwnership } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatDateInput, mendozaWallTimeToUtc } from "@/lib/datetime";
import type { ContractPricing } from "@/lib/contract";

export type MonthPoint = { month: string; rentals: number; km: number };

export type VehicleReport = {
  id: string;
  label: string;
  plate: string;
  rentals: number;
  // Días reales de uso: diferencia entre el momento de la entrega y el de la
  // devolución (mismas inspecciones que ya alimentan `km`), no lo pactado en
  // la reserva. Con decimales — un alquiler de medio día suma 0.5.
  days: number;
  income: number;
  cost: number;
  net: number;
  damages: number;
  archived: boolean;
};

/**
 * Ingresos de Caja del período, separados por cuenta propia/ajena del medio
 * de pago elegido. Los egresos van en un único total sin separar: el Origen
 * de todo egreso es siempre una cuenta propia (está validado en `caja/actions.ts`),
 * así que "propio vs ajeno" no aporta información ahí — decisión tomada con
 * el dueño. `incomeUnclassified` cubre el caso raro de un ingreso cuyo medio
 * de pago se borró después (se pierde el ownership; el nombre snapshot queda
 * pero no de qué tipo de cuenta era).
 */
export type CashByOwnership = {
  incomeOwn: number;
  incomeThirdParty: number;
  incomeUnclassified: number;
  expenseTotal: number;
};

export type Reports = {
  kpis: {
    fleet: number;
    rentedNow: number;
    finished: number;
    active: number;
    // Ingresos/egresos/neto: movimientos reales de Caja del período (ver
    // comentario de módulo). `costTotal` es aparte: costo de mantenimiento
    // registrado (no siempre pasa también por Caja como egreso).
    incomeTotal: number;
    expenseTotal: number;
    costTotal: number;
    netTotal: number;
  };
  byMonth: MonthPoint[];
  // Mes a resaltar en el gráfico "por mes" ("YYYY-MM"): el mes puntual
  // elegido arriba (anterior/actual), o null si el período es un rango de N
  // meses (no hay un único mes "seleccionado" para destacar).
  highlightMonth: string | null;
  vehicles: VehicleReport[];
  cashByOwnership: CashByOwnership;
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
  { param: REPORT_PERIOD_PARAMS.current, label: "Este mes" },
  { param: REPORT_PERIOD_PARAMS.previous, label: "Mes anterior" },
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

/** Meses entre `fromYm` y `toYm` (inclusive), como "YYYY-MM". Pura y testeable. */
function monthsBetweenInclusive(fromYm: string, toYm: string): number {
  const [fy, fm] = fromYm.split("-").map(Number);
  const [ty, tm] = toYm.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm) + 1;
}

/**
 * Cuántos meses mostrar en el gráfico "Alquileres finalizados por mes": hasta
 * 12, pero no más atrás que el primer alquiler finalizado que exista en Andes
 * — evita un gráfico lleno de meses en 0 de antes de que el negocio/la app
 * tuviera datos. Sin ningún finalizado todavía, muestra solo el mes actual.
 * El gráfico es **independiente del período elegido arriba** cuando ese
 * período es un mes puntual (mes anterior/este mes): elegir un solo mes no
 * debe colapsar el gráfico histórico a una sola barra.
 */
export function chartMonthCount(now: Date, earliestFinishedMonth: string | null): number {
  if (!earliestFinishedMonth) return 1;
  return Math.min(12, Math.max(1, monthsBetweenInclusive(earliestFinishedMonth, monthOf(now))));
}

/** Lista de meses del gráfico "por mes" — ver `chartMonthCount`. */
export function resolveChartMonths(now: Date, earliestFinishedMonth: string | null): string[] {
  return recentMonths(monthOf(now), chartMonthCount(now, earliestFinishedMonth));
}

export type VehicleSortKey = "rentals" | "days" | "income" | "cost" | "net" | "damages";
export const DEFAULT_VEHICLE_SORT: VehicleSortKey = "income";

type CashMovementForOwnership = {
  type: "income" | "expense";
  amount: number;
  paymentMethodOwnership: PaymentMethodOwnership | null;
};

/** Agrega movimientos de Caja por cuenta propia/ajena (ver `CashByOwnership`). Pura y testeable. */
export function aggregateCashByOwnership(movements: CashMovementForOwnership[]): CashByOwnership {
  const result: CashByOwnership = { incomeOwn: 0, incomeThirdParty: 0, incomeUnclassified: 0, expenseTotal: 0 };
  for (const m of movements) {
    if (m.type === "expense") {
      result.expenseTotal += m.amount;
      continue;
    }
    if (m.paymentMethodOwnership === "own") result.incomeOwn += m.amount;
    else if (m.paymentMethodOwnership === "third_party") result.incomeThirdParty += m.amount;
    else result.incomeUnclassified += m.amount;
  }
  return result;
}

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
    const now = new Date();
    const periodRange = resolveReportPeriod(period, now);

    const [vehicles, earliestFinished, maintenanceByVehicle, damages, activeCount, cashMovementsRaw] =
      await Promise.all([
        // Sin filtrar archivados: un vehículo archivado sigue arrastrando su
        // historial de ingresos/costos del período, aunque ya no esté en la
        // flota operativa.
        prisma.vehicle.findMany({
          select: { id: true, plate: true, brand: true, model: true, status: true, archivedAt: true },
        }),
        // Primer alquiler finalizado (cualquiera): tope real del gráfico "por
        // mes" cuando el período elegido es un mes puntual (ver chartMonthCount).
        prisma.rental.findFirst({
          where: { status: "finished" },
          orderBy: { endAt: "asc" },
          select: { endAt: true },
        }),
        // Agregado en la base (una fila por vehículo) en vez de traer cada
        // registro de mantenimiento — a diferencia de `finished`, acá sí se
        // puede sumar en SQL porque `cost` es una columna numérica simple.
        // También acotado al período: es un costo del mes, no un acumulado.
        prisma.maintenanceLog.groupBy({
          by: ["vehicleId"],
          where: { date: { gte: periodRange.start, lt: periodRange.end } },
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
        // Ingresos/egresos de Caja del período, para el desglose por cuenta
        // propia/ajena — fuente de datos distinta de `finished` (movimientos
        // de efectivo reales, no el total contractual de la reserva).
        prisma.cashMovement.findMany({
          where: { createdAt: { gte: periodRange.start, lt: periodRange.end }, deletedAt: null },
          select: { type: true, amount: true, paymentMethod: { select: { ownership: true } } },
        }),
      ]);

    // El gráfico "por mes" es independiente del período elegido arriba
    // cuando ese período es un mes puntual (anterior/actual): elegir un solo
    // mes no debe colapsar el gráfico histórico a una sola barra. Para un
    // rango de N meses, el gráfico sigue mostrando exactamente esos N meses
    // (mismo comportamiento de antes).
    const chartMonthList =
      period.kind === "months"
        ? periodRange.monthList
        : resolveChartMonths(now, earliestFinished ? monthOf(earliestFinished.endAt) : null);
    const chartStart = monthStartUtc(chartMonthList[0]);
    // Ventana de la query de alquileres finalizados: la más amplia entre el
    // período elegido (KPIs/tabla) y el gráfico (siempre "hasta ahora" en el
    // extremo superior) — cuando difieren, el gráfico es superset.
    const queryStart = chartStart.getTime() < periodRange.start.getTime() ? chartStart : periodRange.start;
    // Mes a resaltar en el gráfico: solo tiene sentido para un mes puntual.
    const highlightMonth = period.kind === "month" ? periodRange.monthList[0] : null;

    // El ingreso sale de un campo Json (`pricing`, con fallback a
    // `bookingTotal`) que no se puede sumar a nivel base de datos — hace
    // falta traer cada alquiler finalizado para resolverlo en JS.
    const finishedInRange = await prisma.rental.findMany({
      where: { status: "finished", endAt: { gte: queryStart, lt: now } },
      select: {
        id: true,
        vehicleId: true,
        pricing: true,
        bookingTotal: true,
        endAt: true,
        inspections: { select: { type: true, km: true, createdAt: true } },
      },
    });

    const vMap = new Map<string, VehicleReport>(
      vehicles.map((v) => [
        v.id,
        {
          id: v.id,
          label: `${v.brand} ${v.model}`,
          plate: v.plate,
          rentals: 0,
          days: 0,
          income: 0,
          cost: 0,
          net: 0,
          damages: 0,
          archived: v.archivedAt != null,
        },
      ]),
    );

    const monthMap = new Map<string, MonthPoint>(chartMonthList.map((m) => [m, { month: m, rentals: 0, km: 0 }]));

    let finishedCount = 0;
    for (const r of finishedInRange) {
      const handover = r.inspections.find((i) => i.type === "handover");
      const ret = r.inspections.find((i) => i.type === "return_");
      const kmDriven = handover && ret ? Math.max(0, ret.km - handover.km) : 0;

      // El gráfico "por mes" siempre suma esta fila si su mes está en el
      // gráfico, sin importar si cae dentro del período elegido para los
      // KPIs/tabla de abajo (ver chartMonthList más arriba).
      const bucket = monthMap.get(monthOf(r.endAt));
      if (bucket) {
        bucket.rentals += 1;
        bucket.km += kmDriven;
      }

      const inPeriod =
        r.endAt.getTime() >= periodRange.start.getTime() && r.endAt.getTime() < periodRange.end.getTime();
      if (!inPeriod) continue;

      finishedCount += 1;
      const pricing = (r.pricing ?? {}) as ContractPricing;
      const income = pricing.total ?? (r.bookingTotal ? Number(r.bookingTotal) : 0);
      const daysRented =
        handover && ret
          ? Math.max(0, (ret.createdAt.getTime() - handover.createdAt.getTime()) / (1000 * 60 * 60 * 24))
          : 0;

      const v = r.vehicleId ? vMap.get(r.vehicleId) : undefined;
      if (v) {
        v.rentals += 1;
        v.days += daysRented;
        v.income += income;
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

    const cashByOwnership = aggregateCashByOwnership(
      cashMovementsRaw.map((m) => ({
        type: m.type,
        amount: Number(m.amount),
        paymentMethodOwnership: m.paymentMethod?.ownership ?? null,
      })),
    );
    // "Ingresos"/"Neto" del KPI principal son de Caja (dinero real), no del
    // contrato — mismo criterio que `cashByOwnership`, así que van a
    // coincidir con el desglose por cuenta que se muestra al lado.
    const cashIncomeTotal = cashByOwnership.incomeOwn + cashByOwnership.incomeThirdParty + cashByOwnership.incomeUnclassified;

    return {
      kpis: {
        fleet: vehicles.filter((v) => v.archivedAt == null).length,
        rentedNow: vehicles.filter((v) => v.status === "rented").length,
        finished: finishedCount,
        active: activeCount,
        incomeTotal: cashIncomeTotal,
        expenseTotal: cashByOwnership.expenseTotal,
        costTotal,
        netTotal: cashIncomeTotal - cashByOwnership.expenseTotal,
      },
      byMonth: chartMonthList.map((m) => monthMap.get(m)!),
      highlightMonth,
      vehicles: vehicleReports,
      cashByOwnership,
    };
  },
  ["reports"],
  { revalidate: 60, tags: ["reports"] },
);
