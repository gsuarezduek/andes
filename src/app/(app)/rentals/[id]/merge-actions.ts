"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";

/**
 * Fusiona una reserva "duplicada" (importada de VikRentCar solo para
 * bloquear el auto en la web, sin entrega real) con la reserva que sí se
 * entregó en Andes (típicamente una carga manual). Mueve el `wpBookingId` —
 * y los datos de referencia de la orden — al destino, y cancela la
 * duplicada liberando su `wpBookingId`. Así el próximo sync matchea la orden
 * contra el destino (que ya no está en `reserved`, por lo que no la vuelve a
 * tocar) en vez de crear una reserva nueva de nuevo.
 *
 * Guarda de evidencia: la duplicada NUNCA puede tener una inspección — si la
 * tiene, es una entrega real, no un duplicado, y no se toca.
 */
export async function mergeDuplicateRental(duplicateId: string, targetId: string): Promise<void> {
  const admin = await requireAdmin();

  if (duplicateId === targetId) {
    throw new Error("Elegí una reserva distinta para fusionar.");
  }

  const [duplicate, target] = await Promise.all([
    prisma.rental.findUnique({
      where: { id: duplicateId },
      include: { inspections: { select: { id: true }, take: 1 } },
    }),
    prisma.rental.findUnique({ where: { id: targetId } }),
  ]);

  if (!duplicate || !target) {
    throw new Error("No se encontró alguna de las dos reservas.");
  }
  if (duplicate.inspections.length > 0) {
    throw new Error(
      "Esta reserva ya tiene una entrega/acta registrada: no es un duplicado, no se puede fusionar.",
    );
  }
  if (duplicate.wpBookingId == null) {
    throw new Error("Esta reserva no viene de VikRentCar: no hay orden para vincular.");
  }
  if (target.wpBookingId != null) {
    throw new Error("La reserva destino ya está vinculada a otra orden de VikRentCar.");
  }

  const noteText = `Fusionada con la reserva de bloqueo de VikRentCar (orden #${duplicate.wpBookingId}, cargada como "${duplicate.clientName}") por ${admin.name ?? admin.email ?? "un admin"}.`;

  // Orden importante: el índice único de `wpBookingId` no es diferible, así
  // que hay que liberarlo en la duplicada ANTES de asignarlo en el destino
  // (si no, la 2ª operación viola la constraint dentro de la misma transacción).
  await prisma.$transaction([
    prisma.rental.update({
      where: { id: duplicate.id },
      data: { wpBookingId: null, status: "cancelled" },
    }),
    prisma.rental.update({
      where: { id: target.id },
      data: {
        wpBookingId: duplicate.wpBookingId,
        bookingConfirmed: duplicate.bookingConfirmed,
        bookingDays: target.bookingDays ?? duplicate.bookingDays,
        bookingPricePerDay: target.bookingPricePerDay ?? duplicate.bookingPricePerDay,
        bookingTotal: target.bookingTotal ?? duplicate.bookingTotal,
        bookingPaid: target.bookingPaid ?? duplicate.bookingPaid,
        bookingNote: target.bookingNote ?? duplicate.bookingNote,
        bookingModel: target.bookingModel ?? duplicate.bookingModel,
        bookingPickupPlace: target.bookingPickupPlace ?? duplicate.bookingPickupPlace,
        bookingReturnPlace: target.bookingReturnPlace ?? duplicate.bookingReturnPlace,
        bookingAccessories: target.bookingAccessories ?? duplicate.bookingAccessories,
        bookingAccessoriesAmount: target.bookingAccessoriesAmount ?? duplicate.bookingAccessoriesAmount,
        bookingInsuranceUpgrade: target.bookingInsuranceUpgrade || duplicate.bookingInsuranceUpgrade,
        bookingPaymentMethod: target.bookingPaymentMethod ?? duplicate.bookingPaymentMethod,
        clientCountry: target.clientCountry ?? duplicate.clientCountry,
      },
    }),
    prisma.rentalNote.create({
      data: { rentalId: target.id, text: noteText, createdById: admin.id },
    }),
  ]);

  revalidatePath(`/rentals/${target.id}`);
  revalidatePath(`/rentals/${duplicate.id}`);
  revalidatePath("/rentals");
  revalidatePath("/calendar");
  redirect(`/rentals/${target.id}?fusion=ok`);
}
