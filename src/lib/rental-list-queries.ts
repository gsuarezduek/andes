import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type RentalRow = Prisma.RentalGetPayload<{
  include: { vehicle: true; _count: { select: { teamNotes: true } } };
}>;

export type RentalListData = {
  current: RentalRow[];
  currentTotal: number;
  past: RentalRow[];
  pastTotal: number;
  currentMore: boolean;
  pastMore: boolean;
};

// Límite defensivo por sección: sin él, al sincronizar miles de órdenes de
// VikRentCar la lista traería todo.
const LIMIT = 50;

export async function getRentalListData(
  currentWhere: Prisma.RentalWhereInput,
  pastWhere: Prisma.RentalWhereInput,
): Promise<RentalListData> {
  const [current, currentTotal, past, pastTotal] = await Promise.all([
    prisma.rental.findMany({
      where: currentWhere,
      orderBy: { startAt: "asc" }, // en curso primero, luego los próximos
      include: { vehicle: true, _count: { select: { teamNotes: { where: { resolvedAt: null } } } } },
      take: LIMIT,
    }),
    prisma.rental.count({ where: currentWhere }),
    prisma.rental.findMany({
      where: pastWhere,
      orderBy: { endAt: "desc" }, // los que terminaron hace menos, primero
      include: { vehicle: true, _count: { select: { teamNotes: { where: { resolvedAt: null } } } } },
      take: LIMIT,
    }),
    prisma.rental.count({ where: pastWhere }),
  ]);

  return {
    current,
    currentTotal,
    past,
    pastTotal,
    currentMore: currentTotal > current.length,
    pastMore: pastTotal > past.length,
  };
}
