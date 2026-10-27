"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/auth-helpers";
import { displayName } from "@/lib/user-display";
import { mendozaWallTimeToUtc } from "@/lib/datetime";
import { maintenanceTypeLabels } from "@/lib/labels";
import { parseDecimal } from "@/lib/number-input";
import { vehicleDisplayName } from "@/lib/vehicle-ui";
import { buildMaintenanceDebt } from "@/lib/maintenance-debt";

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
  // Si hay costo, a qué proveedor/asociado se le debe: queda como deuda en su
  // cuenta corriente de Caja (ver `buildMaintenanceDebt`), no como egreso.
  accountId: z.string().optional(),
  accountNote: z.string().trim().max(300).optional(),
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
    accountId: formData.get("accountId") || undefined,
    accountNote: formData.get("accountNote") || undefined,
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos.");
  const { cost } = parsed.data;

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: { plate: true, name: true, brand: true, model: true, currentKm: true, serviceIntervalKm: true },
  });
  if (!vehicle) throw new Error("El vehículo no existe.");

  // "No cargar deuda": el costo queda en el mantenimiento pero la deuda se
  // registra aparte con una compensación (ver MaintenanceDebtAccountField).
  const debt =
    cost != null && cost > 0 && formData.get("skipDebt") !== "on"
      ? await buildMaintenanceDebt({
          accountId: parsed.data.accountId,
          accountNote: parsed.data.accountNote,
          amount: cost,
          description: `${maintenanceTypeLabels[parsed.data.type]} — ${vehicleDisplayName(vehicle)}: ${parsed.data.description}`,
          user: { id: user.id, name: displayName(user) },
        })
      : null;

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
              // Service hecho: la alerta pospuesta ya no aplica.
              serviceSnoozedUntilKm: null,
              serviceSnoozedUntil: null,
              serviceSnoozedByName: null,
              ...(parsed.data.km > vehicle.currentKm ? { currentKm: parsed.data.km } : {}),
            },
          }),
        ]
      : []),
    ...(debt ? [prisma.cashMovement.create({ data: debt })] : []),
  ]);

  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath("/caja");
}

export async function deleteMaintenance(vehicleId: string, id: string) {
  await requireAdmin();
  await prisma.maintenanceLog.delete({ where: { id } });
  revalidatePath(`/vehicles/${vehicleId}`);
}
