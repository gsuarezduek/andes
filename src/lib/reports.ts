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
import { prisma } from "@/lib/prisma";
import { formatDateInput } from "@/lib/datetime";
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

/** Últimos 12 meses en hora de Mendoza, del más viejo al actual. */
function last12Months(): string[] {
  return recentMonths(monthOf(new Date()), 12);
}

export async function getReports(): Promise<Reports> {
  const [vehicles, finished, maintenance, damages, activeCount] = await Promise.all([
    prisma.vehicle.findMany({
      where: { archivedAt: null },
      select: { id: true, plate: true, brand: true, model: true, status: true },
    }),
    prisma.rental.findMany({
      where: { status: "finished" },
      select: {
        id: true,
        vehicleId: true,
        pricing: true,
        bookingTotal: true,
        endAt: true,
        inspections: { select: { type: true, km: true } },
      },
    }),
    prisma.maintenanceLog.findMany({ select: { vehicleId: true, cost: true } }),
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
      },
    ]),
  );

  const months = last12Months();
  const monthMap = new Map<string, MonthPoint>(months.map((m) => [m, { month: m, rentals: 0, km: 0 }]));

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
  for (const m of maintenance) {
    const cost = m.cost ? Number(m.cost) : 0;
    costTotal += cost;
    const v = vMap.get(m.vehicleId);
    if (v) v.cost += cost;
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
      fleet: vehicles.length,
      rentedNow: vehicles.filter((v) => v.status === "rented").length,
      finished: finished.length,
      active: activeCount,
      incomeTotal,
      costTotal,
      netTotal: incomeTotal - costTotal,
    },
    byMonth: months.map((m) => monthMap.get(m)!),
    vehicles: vehicleReports,
  };
}
