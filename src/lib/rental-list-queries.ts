import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { RentalSort } from "@/lib/rental-list-filters";

export type RentalRow = Prisma.RentalGetPayload<{
  include: { vehicle: true; _count: { select: { teamNotes: true } } };
}>;

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

function orderByFor(section: "current" | "past", sort: RentalSort): Prisma.RentalOrderByWithRelationInput {
  if (sort === "cliente") return { clientName: "asc" };
  if (sort === "estado") return { status: "asc" };
  // Default "fecha": en curso primero para Actuales, recién terminados primero para Pasados.
  return section === "current" ? { startAt: "asc" } : { endAt: "desc" };
}

export async function getRentalListData(
  currentWhere: Prisma.RentalWhereInput,
  pastWhere: Prisma.RentalWhereInput,
  { sort, currentPage, pastPage }: { sort: RentalSort; currentPage: number; pastPage: number },
): Promise<RentalListData> {
  const [current, currentTotal, past, pastTotal] = await Promise.all([
    prisma.rental.findMany({
      where: currentWhere,
      orderBy: orderByFor("current", sort),
      include: { vehicle: true, _count: { select: { teamNotes: { where: { resolvedAt: null } } } } },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.rental.count({ where: currentWhere }),
    prisma.rental.findMany({
      where: pastWhere,
      orderBy: orderByFor("past", sort),
      include: { vehicle: true, _count: { select: { teamNotes: { where: { resolvedAt: null } } } } },
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
