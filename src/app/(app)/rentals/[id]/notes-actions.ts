"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { displayName } from "@/lib/user-display";
import { OPERATOR_FILTER } from "@/lib/users";
import { completeTaskTx } from "@/lib/task-completion";

function emptyToNull(v: FormDataEntryValue | null): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
}

const addNoteSchema = z.object({
  text: z.string().trim().min(1).max(1000),
  mentionedUserId: z.string().nullable(),
});

// Nota interna del equipo sobre una reserva (misma lógica que VehicleNote).
// Mientras no se resuelva, aparece como notificación en el listado de
// Alquileres y en la barra del Calendario. Si el texto menciona (@) a un
// compañero (`mentionedUserId`, cargado por el autocompletado del textarea —
// ver MentionTextarea, no se vuelve a parsear el texto acá), la nota genera
// además una tarea para esa persona (`Task.sourceRentalNoteId`): completar
// esa tarea resuelve esta nota también, ver `completeTaskTx`.
export async function addRentalNote(rentalId: string, formData: FormData) {
  const user = await requireUser();
  const { text, mentionedUserId } = addNoteSchema.parse({
    text: formData.get("text"),
    mentionedUserId: emptyToNull(formData.get("mentionedUserId")),
  });

  const mentioned = mentionedUserId
    ? await prisma.user.findFirst({ where: { id: mentionedUserId, ...OPERATOR_FILTER }, select: { id: true, name: true } })
    : null;

  await prisma.$transaction(async (tx) => {
    const note = await tx.rentalNote.create({
      data: { rentalId, text, createdById: user.id, createdByName: displayName(user) },
    });
    if (mentioned) {
      await tx.task.create({
        data: {
          text,
          rentalId,
          assignedToId: mentioned.id,
          assignedToName: mentioned.name,
          sourceRentalNoteId: note.id,
          createdById: user.id,
          createdByName: displayName(user),
        },
      });
    }
  });

  revalidatePath(`/rentals/${rentalId}`);
  revalidatePath("/rentals");
  revalidatePath("/calendar");
  if (mentioned) {
    revalidatePath("/tasks");
    revalidatePath("/");
  }
}

export async function resolveRentalNote(rentalId: string, id: string) {
  const user = await requireUser();
  await prisma.$transaction(async (tx) => {
    await tx.rentalNote.update({
      where: { id, rentalId },
      data: { resolvedById: user.id, resolvedByName: displayName(user), resolvedAt: new Date() },
    });
    // Si esta nota había generado una tarea (mención @), resolverla desde
    // acá también la completa — misma consistencia que al revés (completar
    // la tarea resuelve la nota, ver completeTaskTx).
    const task = await tx.task.findFirst({ where: { sourceRentalNoteId: id, status: "pending" } });
    if (task) await completeTaskTx(tx, task.id, user);
  });
  revalidatePath(`/rentals/${rentalId}`);
  revalidatePath("/rentals");
  revalidatePath("/calendar");
  revalidatePath("/tasks");
  revalidatePath("/");
}
