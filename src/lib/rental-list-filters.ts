import type { Prisma, RentalStatus } from "@prisma/client";
import { mendozaWallTimeToUtc } from "@/lib/datetime";

export const RENTAL_STATUSES: RentalStatus[] = ["reserved", "active", "finished", "cancelled"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type RentalListSearchParams = {
  q?: string;
  status?: string;
  confirm?: string;
  desde?: string;
  hasta?: string;
};

export type RentalListFilters = {
  query?: string;
  statusFilter: RentalStatus | null;
  confirm: "all" | "confirmed" | "unconfirmed";
  desde: string;
  hasta: string;
  hasFilters: boolean;
};

export function parseRentalListFilters(sp: RentalListSearchParams): RentalListFilters {
  const query = sp.q?.trim();
  const statusFilter = RENTAL_STATUSES.includes(sp.status as RentalStatus)
    ? (sp.status as RentalStatus)
    : null;
  const confirm = sp.confirm === "confirmed" || sp.confirm === "unconfirmed" ? sp.confirm : "all";
  const desde = sp.desde && DATE_RE.test(sp.desde) ? sp.desde : "";
  const hasta = sp.hasta && DATE_RE.test(sp.hasta) ? sp.hasta : "";
  const hasFilters = Boolean(query || statusFilter || confirm !== "all" || desde || hasta);
  return { query, statusFilter, confirm, desde, hasta, hasFilters };
}

/**
 * "Actuales": la devolución aún no pasó, o el alquiler está activo (el auto
 * sigue afuera aunque esté vencido → hay que hacer la devolución). "Pasados":
 * la fecha de devolución ya pasó y no está activo — sin importar el estado,
 * porque muchos alquileres viejos se cerraron en papel y siguen "reservados".
 */
export function buildRentalWhereClauses(filters: RentalListFilters): {
  currentWhere: Prisma.RentalWhereInput;
  pastWhere: Prisma.RentalWhereInput;
} {
  // Filtros combinables (se aplican a "Actuales" y "Pasados").
  const clauses: Prisma.RentalWhereInput[] = [];
  if (filters.query) {
    const or: Prisma.RentalWhereInput[] = [
      { clientName: { contains: filters.query, mode: "insensitive" } },
      { vehicle: { plate: { contains: filters.query, mode: "insensitive" } } },
    ];
    // Un número también busca por N° de orden de VikRentCar.
    if (/^\d+$/.test(filters.query)) or.push({ wpBookingId: Number(filters.query) });
    clauses.push({ OR: or });
  }
  if (filters.statusFilter) clauses.push({ status: filters.statusFilter });
  if (filters.confirm === "confirmed") clauses.push({ bookingConfirmed: true });
  else if (filters.confirm === "unconfirmed") clauses.push({ bookingConfirmed: false });
  // Rango sobre la fecha de retiro (hora de Mendoza).
  const startAt: Prisma.DateTimeFilter = {};
  if (filters.desde) startAt.gte = mendozaWallTimeToUtc(`${filters.desde}T00:00`);
  if (filters.hasta) startAt.lte = mendozaWallTimeToUtc(`${filters.hasta}T23:59`);
  if (startAt.gte || startAt.lte) clauses.push({ startAt });

  const now = new Date();
  return {
    currentWhere: { AND: [...clauses, { OR: [{ endAt: { gte: now } }, { status: "active" }] }] },
    pastWhere: { AND: [...clauses, { endAt: { lt: now } }, { status: { not: "active" } }] },
  };
}
