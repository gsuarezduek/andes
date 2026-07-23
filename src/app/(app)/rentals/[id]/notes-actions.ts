"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";

const addNoteSchema = z.object({
  text: z.string().trim().min(1).max(1000),
});

// Nota interna del equipo sobre una reserva (misma lógica que VehicleNote).
// Mientras no se resuelva, aparece como notificación en el listado de
// Alquileres y en la barra del Calendario.
export async function addRentalNote(rentalId: string, formData: FormData) {
  const user = await requireUser();
  const { text } = addNoteSchema.parse({ text: formData.get("text") });
  await prisma.rentalNote.create({
    data: { rentalId, text, createdById: user.id },
  });
  revalidatePath(`/rentals/${rentalId}`);
  revalidatePath("/rentals");
  revalidatePath("/calendar");
}

export async function resolveRentalNote(rentalId: string, id: string) {
  const user = await requireUser();
  await prisma.rentalNote.update({
    where: { id, rentalId },
    data: { resolvedById: user.id, resolvedAt: new Date() },
  });
  revalidatePath(`/rentals/${rentalId}`);
  revalidatePath("/rentals");
  revalidatePath("/calendar");
}
