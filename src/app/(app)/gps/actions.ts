"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser, requireAdmin } from "@/lib/auth-helpers";

export type FormState = { error?: string };

// Alta y asignación son tareas operativas del día a día (son los empleados
// quienes instalan/mueven los GPS entre autos) — cualquier usuario logueado
// puede hacerlas, igual que cargar un service o una nota de equipo. Borrar un
// dispositivo del catálogo es más excepcional (se dio de baja el equipo
// físico) y queda admin-only, mismo criterio que borrar un medio de pago.
export async function createGpsDevice(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const identifier = String(formData.get("identifier") ?? "").trim();
  if (!identifier) return { error: "El identificador es obligatorio." };
  const notes = String(formData.get("notes") ?? "").trim();

  try {
    await prisma.gpsDevice.create({ data: { identifier, notes: notes || null } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "Ya existe un GPS con ese identificador." };
    }
    throw e;
  }

  revalidatePath("/gps");
  return {};
}

/** Instala (o desinstala, con `vehicleId: null`) un GPS en un vehículo. Un
 *  vehículo puede tener más de un GPS instalado a la vez (ej. uno de respaldo). */
export async function assignGpsDevice(deviceId: string, vehicleId: string | null): Promise<void> {
  await requireUser();

  await prisma.gpsDevice.update({
    where: { id: deviceId },
    data: { vehicleId, installedAt: vehicleId ? new Date() : null },
  });
  revalidatePath("/gps");
  revalidatePath("/vehicles");
}

/** Dónde está físicamente instalado el GPS en el auto (ej. "debajo del
 *  asiento del acompañante"). Igual que la asignación, es tarea operativa del
 *  día a día — cualquier usuario logueado puede editarla. */
export async function updateGpsDeviceNotes(deviceId: string, notes: string): Promise<void> {
  await requireUser();
  await prisma.gpsDevice.update({
    where: { id: deviceId },
    data: { notes: notes.trim() || null },
  });
  revalidatePath("/gps");
}

/** Borrado real (no es evidencia legal) — mismo criterio que los medios de pago. */
export async function deleteGpsDevice(id: string): Promise<void> {
  await requireAdmin();
  await prisma.gpsDevice.delete({ where: { id } });
  revalidatePath("/gps");
  revalidatePath("/vehicles");
}
