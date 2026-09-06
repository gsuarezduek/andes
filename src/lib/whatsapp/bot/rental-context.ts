import "server-only";
import { prisma } from "@/lib/prisma";
import { phoneVariants } from "@/lib/whatsapp/phone";
import { vehicleLabelWithPlate } from "@/lib/vehicle-ui";
import { formatDateTime } from "@/lib/datetime";

/**
 * El alquiler más relevante del cliente para dar contexto al bot — best
 * effort por teléfono (ver nota en el schema de Customer), preferí un
 * `active` sobre un `reserved` sobre cualquier otro. Nunca incluye pricing
 * ni pagos (decisión de producto: el bot no informa datos económicos).
 */
export async function findRentalContext(phoneE164: string) {
  const rentals = await prisma.rental.findMany({
    where: { clientPhone: { in: phoneVariants(phoneE164) }, status: { in: ["active", "reserved"] } },
    orderBy: { startAt: "desc" },
    select: {
      status: true,
      startAt: true,
      endAt: true,
      bookingConfirmed: true,
      vehicle: { select: { name: true, brand: true, model: true, plate: true } },
    },
  });
  const active = rentals.find((r) => r.status === "active");
  return active ?? rentals[0] ?? null;
}

export function formatRentalContextLine(rental: Awaited<ReturnType<typeof findRentalContext>>): string | null {
  if (!rental) return null;
  const statusLabel =
    rental.status === "active"
      ? "en curso"
      : rental.bookingConfirmed
        ? "reservado (confirmado)"
        : "reservado (sin confirmar todavía)";
  const vehicle = rental.vehicle ? vehicleLabelWithPlate(rental.vehicle) : "sin unidad asignada todavía";
  return [
    `Alquiler ${statusLabel}.`,
    `Vehículo: ${vehicle}.`,
    `Retiro: ${formatDateTime(rental.startAt)}.`,
    `Devolución: ${formatDateTime(rental.endAt)}.`,
    "No informes precios, señas ni saldos aunque te los pregunten — para eso deriva a un humano.",
  ].join(" ");
}
