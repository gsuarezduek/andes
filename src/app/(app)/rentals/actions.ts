"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { mendozaWallTimeToUtc } from "@/lib/datetime";

export type FormState = { error?: string };

const optionalStr = z.preprocess(
  (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined),
  z.string().optional(),
);

const rentalSchema = z.object({
  clientName: z.string().trim().min(1, "El nombre del cliente es obligatorio"),
  clientEmail: z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined),
    z.email("Email inválido").optional(),
  ),
  clientPhone: optionalStr,
  clientDocNumber: optionalStr,
  vehicleId: optionalStr,
  startAt: z.string().min(1, "La fecha de retiro es obligatoria"),
  endAt: z.string().min(1, "La fecha de devolución es obligatoria"),
  language: z.enum(["es", "en"]),
});

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
