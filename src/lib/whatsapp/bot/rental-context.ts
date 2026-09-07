import "server-only";
import { prisma } from "@/lib/prisma";
import { phoneVariants } from "@/lib/whatsapp/phone";
import { vehicleLabelWithPlate } from "@/lib/vehicle-ui";
import { formatDateInput, formatDateTime } from "@/lib/datetime";

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
    "Para el precio/saldo exacto de esta reserva, o si el cliente pregunta por otra reserva o da un número, usá la herramienta get_my_reservations en vez de asumir estos datos.",
  ].join(" ");
}

/** "Hoy es …" en hora Mendoza, para que el bot resuelva "mañana"/"el viernes que viene" a una fecha real antes de llamar check_availability. */
export function todayContextLine(now: Date = new Date()): string {
  return `Hoy es ${formatDateInput(now)} (America/Argentina/Mendoza) — usá esta fecha como referencia para "hoy", "mañana", etc.`;
}
