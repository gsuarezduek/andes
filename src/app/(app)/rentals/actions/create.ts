"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { mendozaWallTimeToUtc } from "@/lib/datetime";
import { findOverlappingRental, overlapErrorMessage } from "@/lib/rental-overlap";
import { rentalSchema, zodFieldErrors, type FormState } from "./schemas";

export async function createRental(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();

  const parsed = rentalSchema.safeParse({
    clientName: formData.get("clientName"),
    clientEmail: formData.get("clientEmail"),
    clientPhone: formData.get("clientPhone"),
    clientDocNumber: formData.get("clientDocNumber"),
    clientAddress: formData.get("clientAddress"),
    vehicleId: formData.get("vehicleId"),
    startAt: formData.get("startAt"),
    endAt: formData.get("endAt"),
    pickupPlace: formData.get("pickupPlace"),
    returnPlace: formData.get("returnPlace"),
    language: formData.get("language"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const startAt = mendozaWallTimeToUtc(parsed.data.startAt);
  const endAt = mendozaWallTimeToUtc(parsed.data.endAt);
  if (endAt <= startAt) {
    return { error: "La devolución debe ser posterior al retiro." };
  }

  // Validar que el vehículo exista si se asignó. Mismo criterio que
  // updateRentalDetails: el rechazo va también en `fieldErrors.vehicleId`
  // para resaltar el <select> en vez de solo mostrar el cartel genérico.
  let thirdParty = false;
  if (parsed.data.vehicleId) {
    const exists = await prisma.vehicle.findUnique({
      where: { id: parsed.data.vehicleId },
      select: { id: true, ownership: true },
    });
    if (!exists) {
      const msg = "El vehículo seleccionado no existe.";
      return { error: msg, fieldErrors: { vehicleId: msg } };
    }
    thirdParty = exists.ownership === "third_party";

    // Un auto de tercero no pasa por VikRentCar: nadie más carga dónde se
    // retira y se devuelve, así que es obligatorio acá.
    if (thirdParty && (!parsed.data.pickupPlace || !parsed.data.returnPlace)) {
      const fieldErrors: Partial<Record<string, string>> = {};
      if (!parsed.data.pickupPlace) fieldErrors.pickupPlace = "Elegí el lugar de retiro.";
      if (!parsed.data.returnPlace) fieldErrors.returnPlace = "Elegí el lugar de devolución.";
      return { error: "Falta el lugar de retiro o de devolución.", fieldErrors };
    }

    // Choque de fechas: no es un bloqueo duro (ver mismo criterio en
    // updateRentalDetails). Acá además las fechas son editables en el mismo
    // form, así que la confirmación se ata a auto+fechas puntuales — si
    // cambia cualquiera de las tres, la vieja confirmación no aplica y se
    // vuelve a validar.
    const overlapKey = `${parsed.data.vehicleId}|${startAt.toISOString()}|${endAt.toISOString()}`;
    const alreadyConfirmed = formData.get("confirmOverlapFor") === overlapKey;
    if (!alreadyConfirmed) {
      const clash = await findOverlappingRental(parsed.data.vehicleId, startAt, endAt);
      if (clash) {
        const msg = overlapErrorMessage(clash);
        return {
          error: msg,
          fieldErrors: { vehicleId: msg },
          overlapConfirm: true,
          attemptedVehicleId: parsed.data.vehicleId,
          overlapKey,
        };
      }
    }
  }

  const rental = await prisma.rental.create({
    data: {
      clientName: parsed.data.clientName,
      clientEmail: parsed.data.clientEmail ?? null,
      clientPhone: parsed.data.clientPhone ?? null,
      clientDocNumber: parsed.data.clientDocNumber ?? null,
      clientAddress: parsed.data.clientAddress ?? null,
      vehicleId: parsed.data.vehicleId ?? null,
      startAt,
      endAt,
      // Los lugares solo se piden en autos de terceros; en los propios los
      // trae VikRentCar (o se corrigen después desde el detalle).
      bookingPickupPlace: thirdParty ? parsed.data.pickupPlace ?? null : null,
      bookingReturnPlace: thirdParty ? parsed.data.returnPlace ?? null : null,
      language: parsed.data.language,
      origin: "manual",
      status: "reserved",
    },
  });

  revalidatePath("/rentals");
  redirect(`/rentals/${rental.id}`);
}
