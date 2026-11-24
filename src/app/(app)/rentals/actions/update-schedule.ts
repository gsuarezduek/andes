"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { mendozaWallTimeToUtc } from "@/lib/datetime";
import { findOverlappingRental, overlapErrorMessage } from "@/lib/rental-overlap";
import { autoUnverifyRental } from "@/lib/rental-verification-server";
import { isManualThirdPartyRental } from "@/lib/rental-flags";
import { scheduleSchema, zodFieldErrors, type FormState } from "./schemas";

/**
 * Corrige a mano la hora y el lugar de retiro/devolución de un alquiler —
 * tanto para reservas manuales como de VikRentCar (pedido del dueño: no
 * depender de ir a cambiarlo en la web). A partir de esta edición, el sync
 * deja de pisar lo tocado (`datesEditedAt`/`placesEditedAt`, mismo patrón que
 * `clientEditedAt`) para esta reserva — ver `booking-upsert.ts`.
 *
 * El retiro (`startAt`/`pickupPlace`) solo se puede tocar mientras la reserva
 * sigue `reserved` (el auto todavía no se entregó); la devolución
 * (`endAt`/`returnPlace`) también en `active`. Esto es una corrección de
 * dato, sin cargo — para una extensión real con cobro está `extendRental`.
 *
 * En un alquiler manual de un auto de tercero (que no pasa por VikRentCar) el
 * mismo form también corrige el método de pago y el idioma: el form los manda
 * solo en ese caso, y acá se ignoran en cualquier otro (en las reservas de la
 * web los trae el sync).
 */
export async function updateRentalSchedule(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();

  const parsed = scheduleSchema.safeParse({
    rentalId: formData.get("rentalId"),
    startAt: formData.get("startAt"),
    pickupPlace: formData.get("pickupPlace"),
    endAt: formData.get("endAt"),
    returnPlace: formData.get("returnPlace"),
    bookingPaymentMethod: formData.get("bookingPaymentMethod") ?? undefined,
    language: formData.get("language") ?? undefined,
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const rental = await prisma.rental.findUnique({
    where: { id: parsed.data.rentalId },
    include: { vehicle: { select: { ownership: true } } },
  });
  if (!rental) return { error: "El alquiler no existe." };
  if (rental.status !== "reserved" && rental.status !== "active") {
    return { error: "No se puede modificar un alquiler finalizado o cancelado." };
  }

  const canEditPickup = rental.status === "reserved";
  const nextStartAt =
    canEditPickup && parsed.data.startAt ? mendozaWallTimeToUtc(parsed.data.startAt) : rental.startAt;
  const nextEndAt = mendozaWallTimeToUtc(parsed.data.endAt);
  if (nextEndAt <= nextStartAt) {
    return { error: "La devolución debe ser posterior al retiro." };
  }

  const datesChanged =
    nextStartAt.getTime() !== rental.startAt.getTime() || nextEndAt.getTime() !== rental.endAt.getTime();

  if (rental.vehicleId && datesChanged) {
    // Choque de fechas: las fechas son editables en el mismo form, así que la
    // confirmación se ata a auto+fechas puntuales (mismo criterio que create.ts).
    const overlapKey = `${rental.vehicleId}|${nextStartAt.toISOString()}|${nextEndAt.toISOString()}`;
    const alreadyConfirmed = formData.get("confirmOverlapFor") === overlapKey;
    if (!alreadyConfirmed) {
      const clash = await findOverlappingRental(rental.vehicleId, nextStartAt, nextEndAt, rental.id);
      if (clash) {
        return {
          error: overlapErrorMessage(clash),
          overlapConfirm: true,
          overlapKey,
        };
      }
    }
  }

  const nextPickupPlace = canEditPickup ? parsed.data.pickupPlace ?? null : rental.bookingPickupPlace;
  const nextReturnPlace = parsed.data.returnPlace ?? null;
  const placesChanged =
    nextPickupPlace !== (rental.bookingPickupPlace ?? null) || nextReturnPlace !== (rental.bookingReturnPlace ?? null);

  const editsBookingInfo = isManualThirdPartyRental(rental);
  const bookingInfoData = editsBookingInfo
    ? {
        bookingPaymentMethod: parsed.data.bookingPaymentMethod ?? null,
        ...(parsed.data.language ? { language: parsed.data.language } : {}),
      }
    : {};

  await prisma.$transaction(async (tx) => {
    await tx.rental.update({
      where: { id: rental.id },
      data: {
        ...(canEditPickup ? { startAt: nextStartAt, bookingPickupPlace: nextPickupPlace } : {}),
        endAt: nextEndAt,
        bookingReturnPlace: nextReturnPlace,
        ...bookingInfoData,
        ...(datesChanged ? { datesEditedAt: new Date() } : {}),
        ...(placesChanged ? { placesEditedAt: new Date() } : {}),
      },
    });
    if (datesChanged || placesChanged) {
      await autoUnverifyRental(tx, rental.id, "Se corrigió el horario/lugar de retiro o devolución.");
    }
  });

  revalidatePath(`/rentals/${rental.id}`);
  revalidatePath("/rentals");
  revalidatePath("/calendar");
  return { ok: true };
}
