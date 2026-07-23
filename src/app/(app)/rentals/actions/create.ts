"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { mendozaWallTimeToUtc } from "@/lib/datetime";
import { rentalSchema, type FormState } from "./schemas";

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
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const startAt = mendozaWallTimeToUtc(parsed.data.startAt);
  const endAt = mendozaWallTimeToUtc(parsed.data.endAt);
  if (endAt <= startAt) {
    return { error: "La devolución debe ser posterior al retiro." };
  }

  // Validar que el vehículo exista si se asignó.
  if (parsed.data.vehicleId) {
    const exists = await prisma.vehicle.findUnique({
      where: { id: parsed.data.vehicleId },
      select: { id: true },
    });
    if (!exists) return { error: "El vehículo seleccionado no existe." };
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
