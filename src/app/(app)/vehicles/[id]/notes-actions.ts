"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";

const addNoteSchema = z.object({
  text: z.string().trim().min(1).max(1000),
});

// Nota interna del equipo sobre un vehículo (no es el campo `notes` libre de
// la ficha). Mientras no se resuelva, aparece como notificación en el Calendario.
export async function addVehicleNote(vehicleId: string, formData: FormData) {
  const user = await requireUser();
  const { text } = addNoteSchema.parse({ text: formData.get("text") });
  await prisma.vehicleNote.create({
    data: { vehicleId, text, createdById: user.id },
  });
  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath("/calendar");
}

export async function resolveVehicleNote(vehicleId: string, id: string) {
  const user = await requireUser();
  await prisma.vehicleNote.update({
    where: { id, vehicleId },
    data: { resolvedById: user.id, resolvedAt: new Date() },
  });
  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath("/calendar");
}
