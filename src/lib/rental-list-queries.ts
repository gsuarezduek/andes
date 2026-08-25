import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Notas activas con su texto (no solo el conteo): se muestran inline en el
// listado para no tener que entrar a cada reserva.
const ROW_INCLUDE = {
  vehicle: true,
  teamNotes: {
    where: { resolvedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, text: true },
  },
} satisfies Prisma.RentalInclude;

export type RentalRow = Prisma.RentalGetPayload<{ include: typeof ROW_INCLUDE }>;

export type RentalListData = {
  current: RentalRow[];
  currentTotal: number;
  currentPage: number;
  currentTotalPages: number;
  past: RentalRow[];
  pastTotal: number;
  pastPage: number;
  pastTotalPages: number;
};

// Por página: sin límite, al sincronizar miles de órdenes de VikRentCar la
// lista traería todo de una.
const PAGE_SIZE = 50;

/**
 * Listado filtrado/buscado ("hay filtros activos"): Actuales + Pasados tal
 * como funcionaba antes de dividir la vista por defecto en Atrasadas /
 * Alquilados / Próximas — acá el usuario ya pidió algo puntual (fecha,
 * estado, texto), así que se le muestra todo lo que matchea sin curar.
 * En curso primero para Actuales, recién terminados primero para Pasados.
 */
export async function getRentalListData(
  currentWhere: Prisma.RentalWhereInput,
  pastWhere: Prisma.RentalWhereInput,
  { currentPage, pastPage }: { currentPage: number; pastPage: number },
): Promise<RentalListData> {
  const [current, currentTotal, past, pastTotal] = await Promise.all([
    prisma.rental.findMany({
      where: currentWhere,
      orderBy: { startAt: "asc" },
      include: ROW_INCLUDE,
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.rental.count({ where: currentWhere }),
    prisma.rental.findMany({
      where: pastWhere,
      orderBy: { endAt: "desc" },
      include: ROW_INCLUDE,
      skip: (pastPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.rental.count({ where: pastWhere }),
  ]);

  return {
    current,
    currentTotal,
    currentPage,
    currentTotalPages: Math.max(1, Math.ceil(currentTotal / PAGE_SIZE)),
    past,
    pastTotal,
    pastPage,
    pastTotalPages: Math.max(1, Math.ceil(pastTotal / PAGE_SIZE)),
  };
}

export type RentalListOverview = {
  /** "reserved" cuyo horario de retiro ya pasó y todavía no se entregó. */
  atrasadas: RentalRow[];
  /** `status === "active"`: el auto está afuera ahora mismo. */
  alquilados: RentalRow[];
  /** "reserved" que todavía no arrancó, o "cancelled" a futuro (se sigue
   *  mostrando para no perder de vista que ese hueco de calendario existió). */
  proximas: RentalRow[];
};

// Cap defensivo (mismo criterio que PAGE_SIZE de arriba): la vista por
// defecto no pagina porque cada balde está naturalmente acotado (flota chica
// para Alquilados, ventana del sync para Próximas), pero un límite generoso
// evita una consulta sin techo si algo se desincroniza.
const OVERVIEW_CAP = 300;

/**
 * Vista "curada" por defecto de /rentals (sin filtros activos): separa lo
 * que requiere atención — atrasadas primero, después lo que está afuera
 * ahora, y por último lo que viene — dejando "Pasados" completamente afuera
 * (se accede buscando por fecha o estado, ver rental-list-filters.ts).
 */
export async function getRentalListOverview(now: Date): Promise<RentalListOverview> {
  const [atrasadas, alquilados, proximas] = await Promise.all([
    prisma.rental.findMany({
      where: { status: "reserved", startAt: { lt: now }, endAt: { gte: now } },
      orderBy: { startAt: "asc" },
      include: ROW_INCLUDE,
      take: OVERVIEW_CAP,
    }),
    prisma.rental.findMany({
      where: { status: "active" },
      orderBy: { endAt: "asc" },
      include: ROW_INCLUDE,
      take: OVERVIEW_CAP,
    }),
    prisma.rental.findMany({
      where: {
        OR: [
          { status: "reserved", startAt: { gte: now } },
          { status: "cancelled", endAt: { gte: now } },
        ],
      },
      orderBy: { startAt: "asc" },
      include: ROW_INCLUDE,
      take: OVERVIEW_CAP,
    }),
  ]);

  return { atrasadas, alquilados, proximas };
}
