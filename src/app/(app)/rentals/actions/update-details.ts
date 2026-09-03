"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { findOverlappingRental, overlapErrorMessage } from "@/lib/rental-overlap";
import { updateSchema, zodFieldErrors, type FormState } from "./schemas";

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
    return {
      error: parsed.error.issues[0]?.message ?? "Datos inválidos",
      fieldErrors: zodFieldErrors(parsed.error),
    };
  }

  const rental = await prisma.rental.findUnique({
    where: { id: parsed.data.rentalId },
    include: { inspections: { where: { type: "handover" }, select: { id: true } } },
  });
  if (!rental) return { error: "El alquiler no existe." };
  if (rental.status !== "reserved" || rental.inspections.length > 0) {
    return { error: "No se puede editar: el alquiler ya tiene la entrega registrada." };
  }

  // Validar que el vehículo exista y no esté archivado si se asignó. Estos
  // tres rechazos van también en `fieldErrors.vehicleId` (no solo en
  // `error`) para que el <select> se resalte en rojo con el motivo justo
  // debajo — antes solo se veía el cartel genérico al pie del formulario,
  // fácil de no notar, y el <select> volvía en silencio al valor anterior.
  if (parsed.data.vehicleId) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: parsed.data.vehicleId },
      select: { id: true, archivedAt: true },
    });
    if (!vehicle) {
      const msg = "El vehículo seleccionado no existe.";
      return { error: msg, fieldErrors: { vehicleId: msg } };
    }
    if (vehicle.archivedAt) {
      const msg = "El vehículo seleccionado está archivado.";
      return { error: msg, fieldErrors: { vehicleId: msg } };
    }

    // No permitir reasignar un auto que ya tiene otra reserva/alquiler
    // vigente en fechas que se pisan con esta.
    const clash = await findOverlappingRental(
      parsed.data.vehicleId,
      rental.startAt,
      rental.endAt,
      rental.id,
    );
    if (clash) {
      const msg = overlapErrorMessage(clash);
      return { error: msg, fieldErrors: { vehicleId: msg } };
    }
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
      return {
        error: "Asigná un vehículo para poder iniciar la entrega.",
        fieldErrors: { vehicleId: "Asigná un vehículo para continuar." },
      };
    }
    redirect(`/rentals/${rental.id}/handover`);
  }

  return { ok: true };
}
