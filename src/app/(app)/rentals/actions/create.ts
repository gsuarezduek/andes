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
  if (parsed.data.vehicleId) {
    const exists = await prisma.vehicle.findUnique({
      where: { id: parsed.data.vehicleId },
      select: { id: true },
    });
    if (!exists) {
      const msg = "El vehículo seleccionado no existe.";
      return { error: msg, fieldErrors: { vehicleId: msg } };
    }

    // No permitir asignar un auto que ya tiene otra reserva/alquiler vigente
    // en fechas que se pisan.
    const clash = await findOverlappingRental(parsed.data.vehicleId, startAt, endAt);
    if (clash) {
      const msg = overlapErrorMessage(clash);
      return { error: msg, fieldErrors: { vehicleId: msg } };
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
      language: parsed.data.language,
      origin: "manual",
      status: "reserved",
    },
  });

  revalidatePath("/rentals");
  redirect(`/rentals/${rental.id}`);
}
