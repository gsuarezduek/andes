import "server-only";
import { prisma } from "@/lib/prisma";

/** Cuánto hacia atrás se miran las reservas de VikRentCar para armar la lista
 *  de lugares: lo bastante para que estén todos los de la web, sin arrastrar
 *  nombres que VikRentCar ya renombró hace mucho. */
const PLACES_LOOKBACK_DAYS = 365;

/**
 * Lugares de retiro/devolución "de la web", para elegirlos en un alquiler
 * manual (autos de terceros). VikRentCar no expone su tabla de lugares por el
 * plugin `andes-sync`, pero cada reserva sincronizada trae el nombre tal cual
 * (`wp_vikrentcar_places.name`), así que la lista sale de ahí: los nombres
 * distintos que usaron las reservas del último año, de más a menos usados.
 * Si no hay ninguna (base nueva), la lista queda vacía y el campo es texto
 * libre.
 */
export async function getBookingPlaceOptions(): Promise<string[]> {
  const since = new Date(Date.now() - PLACES_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const where = { origin: "vikrentcar" as const, startAt: { gte: since } };
  const [pickups, returns] = await Promise.all([
    prisma.rental.groupBy({
      by: ["bookingPickupPlace"],
      where: { ...where, bookingPickupPlace: { not: null } },
      _count: { _all: true },
    }),
    prisma.rental.groupBy({
      by: ["bookingReturnPlace"],
      where: { ...where, bookingReturnPlace: { not: null } },
      _count: { _all: true },
    }),
  ]);
  return rankNames([
    ...pickups.map((p) => ({ name: p.bookingPickupPlace, count: p._count._all })),
    ...returns.map((r) => ({ name: r.bookingReturnPlace, count: r._count._all })),
  ]);
}

/**
 * Métodos de pago "de la web" (los de VikRentCar, `WpPaymentMethod`), para
 * anotarlos en un alquiler manual. Solo los activos (o sin dato, plugin viejo).
 */
export async function getBookingPaymentMethodOptions(): Promise<string[]> {
  const methods = await prisma.wpPaymentMethod.findMany({
    where: { OR: [{ active: true }, { active: null }] },
    orderBy: { name: "asc" },
    select: { name: true },
  });
  return methods.map((m) => m.name);
}

/** Suma los usos de cada nombre (sin espacios de más) y los ordena de más a menos usados. */
export function rankNames(rows: { name: string | null; count: number }[]): string[] {
  const totals = new Map<string, number>();
  for (const { name, count } of rows) {
    const trimmed = name?.trim();
    if (!trimmed) continue;
    totals.set(trimmed, (totals.get(trimmed) ?? 0) + count);
  }
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es"))
    .map(([name]) => name);
}
