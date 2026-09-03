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

  try {
    await prisma.gpsDevice.create({ data: { identifier } });
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
 *  vehículo no puede tener dos GPS a la vez (`GpsDevice.vehicleId` es único) —
 *  se valida acá primero para devolver un mensaje claro en vez de un error de
 *  constraint. */
export async function assignGpsDevice(deviceId: string, vehicleId: string | null): Promise<void> {
  await requireUser();

  if (vehicleId) {
    const clash = await prisma.gpsDevice.findUnique({
      where: { vehicleId },
      select: { identifier: true },
    });
    if (clash) {
      throw new Error(`Ese vehículo ya tiene instalado el GPS "${clash.identifier}".`);
    }
  }

  await prisma.gpsDevice.update({
    where: { id: deviceId },
    data: { vehicleId, installedAt: vehicleId ? new Date() : null },
  });
  revalidatePath("/gps");
  revalidatePath("/vehicles");
}

/** Borrado real (no es evidencia legal) — mismo criterio que los medios de pago. */
export async function deleteGpsDevice(id: string): Promise<void> {
  await requireAdmin();
  await prisma.gpsDevice.delete({ where: { id } });
  revalidatePath("/gps");
  revalidatePath("/vehicles");
}
