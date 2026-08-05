"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { mendozaWallTimeToUtc } from "@/lib/datetime";
import { maintenanceTypeLabels } from "@/lib/labels";
import { parseDecimal } from "@/lib/number-input";

const optNum = z.preprocess(
  (v) => (v === "" || v == null ? undefined : Number(v)),
  z.number().nonnegative().optional(),
);
const optCost = z.preprocess(
  (v) => (v === "" || v == null ? undefined : parseDecimal(String(v))),
  z.number().nonnegative().optional(),
);

const schema = z.object({
  type: z.enum(["service", "repair"]),
  date: z.string().min(1),
  km: optNum,
  cost: optCost,
  place: z.string().trim().optional(),
  description: z.string().trim().min(1, "Describí el service o arreglo"),
  // Si hay costo, de dónde sale la plata — mismo criterio que createMaintenance
  // (ficha del vehículo): el gasto queda en Caja como gasto general del
  // negocio, no vinculado a esta reserva (es un costo del auto, no del cliente).
  paymentMethodId: z.string().optional(),
  paymentMethodNote: z.string().trim().max(300).optional(),
});

/**
 * Única acción de "Service / arreglo" desde el detalle de una reserva: para
 * alquileres cargados solo para bloquear el auto (reservado, sin entrega
 * hecha), registra el service/arreglo y deja el auto fuera de servicio. El
 * alquiler placeholder se cancela — no hay forma de "solo anotar" sin ese
 * efecto, a propósito (antes había un acceso rápido que sólo registraba el
 * mantenimiento sin tocar nada más; se unificó en esta única acción).
 */
export async function markVehicleService(
  rentalId: string,
  vehicleId: string,
  formData: FormData,
): Promise<void> {
  const user = await requireUser();

  const parsed = schema.safeParse({
    type: formData.get("type"),
    date: formData.get("date"),
    km: formData.get("km"),
    cost: formData.get("cost"),
    place: formData.get("place"),
    description: formData.get("description"),
    paymentMethodId: formData.get("paymentMethodId") || undefined,
    paymentMethodNote: formData.get("paymentMethodNote") || undefined,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }
  const data = parsed.data;

  let method: { id: string; name: string; requiresNote: boolean } | null = null;
  if (data.cost != null && data.cost > 0) {
    if (!data.paymentMethodId) throw new Error("Indicá de dónde sale la plata para este gasto.");
    method = await prisma.paymentMethod.findUnique({ where: { id: data.paymentMethodId } });
    if (!method) throw new Error("Medio de pago inválido");
    if (method.requiresNote && !data.paymentMethodNote) {
      throw new Error("Este medio de pago requiere indicar a dónde fue.");
    }
  }

  const rental = await prisma.rental.findUnique({
    where: { id: rentalId },
    select: { vehicleId: true, status: true },
  });
  // Guardas: el alquiler debe estar sin iniciar (reservado) y apuntar a este auto.
  if (!rental || rental.vehicleId !== vehicleId || rental.status !== "reserved") {
    throw new Error("Esta reserva ya no se puede marcar a service (¿ya se hizo la entrega?).");
  }

  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { plate: true } });
  if (!vehicle) throw new Error("El vehículo no existe.");

  await prisma.$transaction([
    prisma.maintenanceLog.create({
      data: {
        vehicleId,
        type: data.type,
        date: mendozaWallTimeToUtc(`${data.date}T12:00`),
        km: data.km ?? null,
        cost: data.cost ?? null,
        place: data.place || null,
        description: data.description,
      },
    }),
    prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        status: "out_of_service",
        ...(data.km != null ? { currentKm: data.km } : {}),
      },
    }),
    // El alquiler era solo para bloquear el auto: se cancela.
    prisma.rental.update({ where: { id: rentalId }, data: { status: "cancelled" } }),
    ...(method
      ? [
          prisma.cashMovement.create({
            data: {
              type: "expense" as const,
              description: `${maintenanceTypeLabels[data.type]} — ${vehicle.plate}: ${data.description}`,
              amount: data.cost!,
              paymentMethodId: method.id,
              paymentMethodName: method.name,
              paymentMethodNote: method.requiresNote ? (data.paymentMethodNote ?? null) : null,
              createdById: user.id,
            },
          }),
        ]
      : []),
  ]);

  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath(`/rentals/${rentalId}`);
  revalidatePath("/rentals");
  revalidatePath("/caja");
  redirect(`/vehicles/${vehicleId}`);
}
