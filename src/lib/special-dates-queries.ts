import "server-only";
import { prisma } from "@/lib/prisma";
import { dateToKey, keyToDate } from "@/lib/rooms/dates";
import { addDaysToKey } from "@/lib/rooms/ical";

export type SpecialDateRow = {
  id: string;
  date: string; // "YYYY-MM-DD"
  label: string;
  createdByName: string;
  createdAt: Date;
};

/** Fechas especiales en `[fromKey, toKeyExclusive)`, como mapa "YYYY-MM-DD" → fila (para pintar columnas). */
export async function getSpecialDatesMap(fromKey: string, toKeyExclusive: string): Promise<Map<string, SpecialDateRow>> {
  const rows = await prisma.specialDate.findMany({
    where: { date: { gte: keyToDate(fromKey), lt: keyToDate(toKeyExclusive) } },
    orderBy: { date: "asc" },
  });
  return new Map(
    rows.map((r) => [
      dateToKey(r.date),
      { id: r.id, date: dateToKey(r.date), label: r.label, createdByName: r.createdByName, createdAt: r.createdAt },
    ]),
  );
}

/** Próximos `days` (hoy incluido), ordenados por fecha, para la lista de /horarios. */
export async function getUpcomingSpecialDates(todayKey: string, days = 30): Promise<SpecialDateRow[]> {
  const map = await getSpecialDatesMap(todayKey, addDaysToKey(todayKey, days));
  return [...map.values()];
}
