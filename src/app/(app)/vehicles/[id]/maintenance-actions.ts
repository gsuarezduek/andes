"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { mendozaWallTimeToUtc } from "@/lib/datetime";

const optInt = z.preprocess(
  (v) => (v === "" || v == null ? undefined : Number(v)),
  z.number().int().nonnegative().optional(),
);
const optCost = z.preprocess(
  (v) => (v === "" || v == null ? undefined : Number(v)),
  z.number().nonnegative().optional(),
);

const schema = z.object({
  type: z.enum(["service", "repair", "expense", "note"]),
  date: z.string().min(1),
  km: optInt,
  cost: optCost,
  description: z.string().trim().min(1),
});

export async function createMaintenance(vehicleId: string, formData: FormData) {
  await requireAdmin();
  const parsed = schema.safeParse({
    type: formData.get("type"),
    date: formData.get("date"),
    km: formData.get("km"),
    cost: formData.get("cost"),
    description: formData.get("description"),
  });
  if (!parsed.success) return;

  await prisma.maintenanceLog.create({
    data: {
      vehicleId,
      type: parsed.data.type,
      date: mendozaWallTimeToUtc(`${parsed.data.date}T12:00`),
      km: parsed.data.km ?? null,
      cost: parsed.data.cost ?? null,
      description: parsed.data.description,
    },
  });

  // Al registrar un service con km, reprogramar el próximo service según el
  // intervalo del vehículo y avanzar el km actual si corresponde.
  if (parsed.data.type === "service" && parsed.data.km != null) {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { currentKm: true, serviceIntervalKm: true },
    });
    if (vehicle) {
      const km = parsed.data.km;
      await prisma.vehicle.update({
        where: { id: vehicleId },
        data: {
          ...(vehicle.serviceIntervalKm ? { nextServiceKm: km + vehicle.serviceIntervalKm } : {}),
          ...(km > vehicle.currentKm ? { currentKm: km } : {}),
        },
      });
    }
  }

  revalidatePath(`/vehicles/${vehicleId}`);
}

export async function deleteMaintenance(vehicleId: string, id: string) {
  await requireAdmin();
  await prisma.maintenanceLog.delete({ where: { id } });
  revalidatePath(`/vehicles/${vehicleId}`);
}
