"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/auth-helpers";
import { mendozaWallTimeToUtc } from "@/lib/datetime";
import { maintenanceTypeLabels } from "@/lib/labels";
import { parseDecimal } from "@/lib/number-input";
import { vehicleDisplayName } from "@/lib/vehicle-ui";

const optInt = z.preprocess(
  (v) => (v === "" || v == null ? undefined : Number(v)),
  z.number().int().nonnegative().optional(),
);
const optCost = z.preprocess(
  (v) => (v === "" || v == null ? undefined : parseDecimal(String(v))),
  z.number().nonnegative().optional(),
);

const schema = z.object({
  type: z.enum(["service", "repair", "expense", "note"]),
  date: z.string().min(1),
  km: optInt,
  cost: optCost,
  place: z.string().trim().optional(),
  description: z.string().trim().min(1),
  // Si hay costo, de dónde sale la plata — igual que un "Pago" de Caja. El
  // gasto queda en Caja como gasto general del negocio (no vinculado a
  // ninguna reserva: es un costo del auto, no del cliente).
  paymentMethodId: z.string().optional(),
  paymentMethodNote: z.string().trim().max(300).optional(),
});

export async function createMaintenance(vehicleId: string, formData: FormData) {
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
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos.");
  const { cost, paymentMethodId, paymentMethodNote } = parsed.data;

  let method: { id: string; name: string; requiresNote: boolean } | null = null;
  if (cost != null && cost > 0) {
    if (!paymentMethodId) throw new Error("Indicá de dónde sale la plata para este gasto.");
    method = await prisma.paymentMethod.findUnique({ where: { id: paymentMethodId } });
    if (!method) throw new Error("Medio de pago inválido");
    if (method.requiresNote && !paymentMethodNote) {
      throw new Error("Este medio de pago requiere indicar a dónde fue.");
    }
  }

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: { plate: true, name: true, brand: true, model: true, currentKm: true, serviceIntervalKm: true },
  });
  if (!vehicle) throw new Error("El vehículo no existe.");

  await prisma.$transaction([
    prisma.maintenanceLog.create({
      data: {
        vehicleId,
        type: parsed.data.type,
        date: mendozaWallTimeToUtc(`${parsed.data.date}T12:00`),
        km: parsed.data.km ?? null,
        cost: cost ?? null,
        place: parsed.data.place || null,
        description: parsed.data.description,
      },
    }),
    // Al registrar un service con km, reprogramar el próximo service según el
    // intervalo del vehículo y avanzar el km actual si corresponde.
    ...(parsed.data.type === "service" && parsed.data.km != null
      ? [
          prisma.vehicle.update({
            where: { id: vehicleId },
            data: {
              ...(vehicle.serviceIntervalKm ? { nextServiceKm: parsed.data.km + vehicle.serviceIntervalKm } : {}),
              ...(parsed.data.km > vehicle.currentKm ? { currentKm: parsed.data.km } : {}),
            },
          }),
        ]
      : []),
    ...(method
      ? [
          prisma.cashMovement.create({
            data: {
              type: "expense",
              description: `${maintenanceTypeLabels[parsed.data.type]} — ${vehicleDisplayName(vehicle)}: ${parsed.data.description}`,
              amount: cost!,
              paymentMethodId: method.id,
              paymentMethodName: method.name,
              paymentMethodNote: method.requiresNote ? (paymentMethodNote ?? null) : null,
              createdById: user.id,
            },
          }),
        ]
      : []),
  ]);

  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath("/caja");
}

export async function deleteMaintenance(vehicleId: string, id: string) {
  await requireAdmin();
  await prisma.maintenanceLog.delete({ where: { id } });
  revalidatePath(`/vehicles/${vehicleId}`);
}
