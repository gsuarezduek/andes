"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { displayName } from "@/lib/user-display";

const DAY_MS = 24 * 60 * 60 * 1000;

const schema = z.object({
  mode: z.enum(["km", "days"]),
  amount: z.number().int().positive().max(100_000),
});

/**
 * Pospone la alerta de service de un auto: no vuelve a aparecer (Home y
 * resumen diario) hasta que el auto haga `amount` km más, o pasen `amount`
 * días — según lo elegido. Cualquier rol (las alertas las ve todo el equipo).
 */
export async function snoozeServiceAlert(
  vehicleId: string,
  input: { mode: "km" | "days"; amount: number },
): Promise<{ error?: string }> {
  const user = await requireUser();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: "Ingresá una cantidad válida." };

  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { currentKm: true } });
  if (!vehicle) return { error: "El vehículo no existe." };

  const { mode, amount } = parsed.data;
  await prisma.vehicle.update({
    where: { id: vehicleId },
    data: {
      serviceSnoozedUntilKm: mode === "km" ? vehicle.currentKm + amount : null,
      serviceSnoozedUntil: mode === "days" ? new Date(Date.now() + amount * DAY_MS) : null,
      serviceSnoozedByName: displayName(user),
    },
  });
  revalidatePath("/");
  revalidatePath(`/vehicles/${vehicleId}`);
  return {};
}

/** Vuelve a mostrar la alerta de service ya mismo (deshace "Posponer"). */
export async function clearServiceSnooze(vehicleId: string): Promise<void> {
  await requireUser();
  await prisma.vehicle.update({
    where: { id: vehicleId },
    data: { serviceSnoozedUntilKm: null, serviceSnoozedUntil: null, serviceSnoozedByName: null },
  });
  revalidatePath("/");
  revalidatePath(`/vehicles/${vehicleId}`);
}
