"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser, requireAdmin } from "@/lib/auth-helpers";
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
  clientAddress: optionalStr,
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

const updateSchema = z.object({
  rentalId: z.string().min(1),
  clientName: z.string().trim().min(1, "El nombre del cliente es obligatorio"),
  clientEmail: z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined),
    z.email("Email inválido").optional(),
  ),
  clientPhone: optionalStr,
  clientDocNumber: optionalStr,
  clientAddress: optionalStr,
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
    clientAddress: formData.get("clientAddress"),
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
      clientAddress: parsed.data.clientAddress ?? null,
      vehicleId: parsed.data.vehicleId ?? null,
      // A partir de esta edición, el sync no vuelve a pisar los datos del cliente.
      clientEditedAt: new Date(),
    },
  });

  revalidatePath(`/rentals/${rental.id}`);
  revalidatePath("/rentals");

  // El botón "Guardar e iniciar entrega" guarda y navega en un solo click, para
  // que no se pierdan ediciones hechas acá si el empleado se olvida de tocar
  // "Guardar datos" antes de ir al wizard.
  if (formData.get("intent") === "startHandover") {
    if (!parsed.data.vehicleId) {
      return { error: "Asigná un vehículo para poder iniciar la entrega." };
    }
    redirect(`/rentals/${rental.id}/handover`);
  }

  return { ok: true };
}

const returnSchema = z.object({
  rentalId: z.string().min(1),
  endAt: z.string().min(1, "La fecha de devolución es obligatoria"),
  returnPlace: optionalStr,
});

/**
 * Modifica la fecha y el lugar de devolución de un alquiler — típico cuando el
 * cliente extiende el alquiler. Solo se permite en **reservas manuales**: las de
 * VikRentCar se gestionan desde la web (fuente de verdad de las fechas) y se
 * sincronizan solas; editarlas acá dejaría la disponibilidad de VikRentCar
 * inconsistente. Se permite mientras el alquiler no esté finalizado ni cancelado
 * (reservado o activo). La devolución debe ser posterior al retiro.
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
    select: { id: true, startAt: true, status: true, origin: true },
  });
  if (!rental) return { error: "El alquiler no existe." };
  if (rental.origin === "vikrentcar") {
    return {
      error:
        "Las fechas de una reserva de VikRentCar se cambian desde la web; se sincronizan solas.",
    };
  }
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

/**
 * Elimina una reserva (solo admin). Pensado para reservas huérfanas: órdenes que
 * se **borraron** en VikRentCar (no canceladas) y quedaron acá como "reservado",
 * o cargas manuales erróneas. **Guarda de evidencia:** no se puede eliminar una
 * reserva que ya tiene una inspección (entrega/acta firmada es inmutable) — esas
 * se conservan siempre. Borra en cascada los documentos y pedidos de firma
 * (que solo existen si hubo un intento de entrega) dentro de una transacción.
 */
export async function deleteRental(id: string): Promise<void> {
  await requireAdmin();

  const rental = await prisma.rental.findUnique({
    where: { id },
    include: { inspections: { select: { id: true }, take: 1 } },
  });
  if (!rental) redirect("/rentals");
  if (rental.inspections.length > 0) {
    throw new Error(
      "No se puede eliminar: la reserva ya tiene una entrega/acta registrada (evidencia inmutable).",
    );
  }

  await prisma.$transaction([
    prisma.signatureRequest.deleteMany({ where: { rentalId: id } }),
    prisma.rentalDocument.deleteMany({ where: { rentalId: id } }),
    prisma.rental.delete({ where: { id } }),
  ]);

  revalidatePath("/rentals");
  redirect("/rentals");
}
