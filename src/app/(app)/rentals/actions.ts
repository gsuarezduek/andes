"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { mendozaWallTimeToUtc } from "@/lib/datetime";

export type FormState = { error?: string; ok?: boolean };

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

const updateSchema = z.object({
  rentalId: z.string().min(1),
  clientName: z.string().trim().min(1, "El nombre del cliente es obligatorio"),
  clientEmail: z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined),
    z.email("Email inválido").optional(),
  ),
  clientPhone: optionalStr,
  clientDocNumber: optionalStr,
  vehicleId: optionalStr,
});

/**
 * Edita los datos de contacto del cliente y el vehículo asignado desde el
 * detalle del alquiler, antes de iniciar la entrega. Solo se permite mientras
 * el alquiler está `reserved` y sin acta de entrega (inspecciones inmutables):
 * una vez entregado, estos datos quedan congelados en el acta.
 */
export async function updateRentalDetails(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();

  const parsed = updateSchema.safeParse({
    rentalId: formData.get("rentalId"),
    clientName: formData.get("clientName"),
    clientEmail: formData.get("clientEmail"),
    clientPhone: formData.get("clientPhone"),
    clientDocNumber: formData.get("clientDocNumber"),
    vehicleId: formData.get("vehicleId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const rental = await prisma.rental.findUnique({
    where: { id: parsed.data.rentalId },
    include: { inspections: { where: { type: "handover" }, select: { id: true } } },
  });
  if (!rental) return { error: "El alquiler no existe." };
  if (rental.status !== "reserved" || rental.inspections.length > 0) {
    return { error: "No se puede editar: el alquiler ya tiene la entrega registrada." };
  }

  // Validar que el vehículo exista y no esté archivado si se asignó.
  if (parsed.data.vehicleId) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: parsed.data.vehicleId },
      select: { id: true, archivedAt: true },
    });
    if (!vehicle) return { error: "El vehículo seleccionado no existe." };
    if (vehicle.archivedAt) return { error: "El vehículo seleccionado está archivado." };
  }

  await prisma.rental.update({
    where: { id: rental.id },
    data: {
      clientName: parsed.data.clientName,
      clientEmail: parsed.data.clientEmail ?? null,
      clientPhone: parsed.data.clientPhone ?? null,
      clientDocNumber: parsed.data.clientDocNumber ?? null,
      vehicleId: parsed.data.vehicleId ?? null,
      // A partir de esta edición, el sync no vuelve a pisar los datos del cliente.
      clientEditedAt: new Date(),
    },
  });

  revalidatePath(`/rentals/${rental.id}`);
  revalidatePath("/rentals");
  return { ok: true };
}

const returnSchema = z.object({
  rentalId: z.string().min(1),
  endAt: z.string().min(1, "La fecha de devolución es obligatoria"),
  returnPlace: optionalStr,
});

/**
 * Modifica la fecha y el lugar de devolución de un alquiler — típico cuando el
 * cliente extiende el alquiler. Se permite mientras el alquiler no esté
 * finalizado ni cancelado (reservado o activo). La devolución debe ser posterior
 * al retiro.
 */
export async function updateReturnDetails(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();

  const parsed = returnSchema.safeParse({
    rentalId: formData.get("rentalId"),
    endAt: formData.get("endAt"),
    returnPlace: formData.get("returnPlace"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const rental = await prisma.rental.findUnique({
    where: { id: parsed.data.rentalId },
    select: { id: true, startAt: true, status: true },
  });
  if (!rental) return { error: "El alquiler no existe." };
  if (rental.status === "finished" || rental.status === "cancelled") {
    return { error: "No se puede modificar un alquiler finalizado o cancelado." };
  }

  const endAt = mendozaWallTimeToUtc(parsed.data.endAt);
  if (endAt <= rental.startAt) {
    return { error: "La devolución debe ser posterior al retiro." };
  }

  await prisma.rental.update({
    where: { id: rental.id },
    data: { endAt, bookingReturnPlace: parsed.data.returnPlace ?? null },
  });

  revalidatePath(`/rentals/${rental.id}`);
  revalidatePath("/rentals");
  return { ok: true };
}
