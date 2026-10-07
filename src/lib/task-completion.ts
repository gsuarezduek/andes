import "server-only";
import type { Prisma, TaskRecurrence } from "@prisma/client";
import { computeNextDueDate } from "@/lib/task-recurrence";

/**
 * Crea la próxima ocurrencia de una serie, clonando su plantilla vigente —
 * compartida entre `completeTaskTx` y `deleteTask` (src/app/(app)/tasks/actions.ts),
 * los dos momentos en que una ocurrencia deja de estar pendiente.
 */
export async function generateNextOccurrence(
  tx: Prisma.TransactionClient,
  recurrence: TaskRecurrence,
  fromDate: Date,
) {
  if (!recurrence.active) return;
  const nextDueDate = computeNextDueDate(recurrence, fromDate);
  await tx.task.create({
    data: {
      text: recurrence.text,
      priority: recurrence.priority,
      dueDate: nextDueDate,
      assignedToId: recurrence.assignedToId,
      assignedToName: recurrence.assignedToName,
      vehicleId: recurrence.vehicleId,
      recurrenceId: recurrence.id,
      createdById: recurrence.createdById,
      createdByName: recurrence.createdByName,
      // Nota: una tarea recurrente vinculada a una reserva puntual no
      // traslada ese vínculo a las ocurrencias siguientes (`TaskRecurrence`
      // no tiene `rentalId`, a diferencia de `vehicleId`) — una reserva es
      // algo puntual en el tiempo, no tiene sentido que una serie repetida
      // sea "de la misma reserva" para siempre.
    },
  });
}

/**
 * Marca una tarea como hecha dentro de una transacción ya abierta —
 * idempotente (no hace nada si ya no está pendiente, mismo guard que antes
 * vivía directo en `completeTask`) — y hace lo mismo que ya hacía esa
 * acción: generar la próxima ocurrencia si la tarea es parte de una serie.
 *
 * Además (v73): si la tarea se generó sola al mencionar (@) a alguien en una
 * nota de equipo de una reserva (`sourceRentalNoteId`), resuelve también esa
 * nota — completar la tarea es, para el usuario, lo mismo que resolver la
 * nota que la generó. Se llama tanto desde `completeTask` (tasks/actions.ts)
 * como desde `resolveRentalNote` (rentals/[id]/notes-actions.ts, la otra
 * dirección: resolver la nota completa la tarea) — un solo lugar con la
 * lógica de completar, para que las dos puertas de entrada queden en sync.
 */
/** `resolvedNoteRentalId`: si completar la tarea resolvió la nota que la
 *  generó, la reserva de esa nota — para que el caller sepa qué más
 *  revalidar (el detalle de esa reserva, el listado, el Calendario: los tres
 *  muestran el contador de notas sin resolver). `null` si no aplica. */
export async function completeTaskTx(
  tx: Prisma.TransactionClient,
  taskId: string,
  user: { id: string; name?: string | null; email?: string | null },
): Promise<{ resolvedNoteRentalId: string | null }> {
  // `status: "pending"` en el where es el guard de idempotencia: un doble
  // submit (doble-tap, reintento, o las dos puertas de entrada disparando
  // casi a la vez) del mismo id no genera la próxima ocurrencia dos veces
  // ni resuelve la nota de origen dos veces.
  const result = await tx.task.updateMany({
    where: { id: taskId, status: "pending" },
    data: { status: "done", completedById: user.id, completedAt: new Date() },
  });
  if (result.count === 0) return { resolvedNoteRentalId: null };

  const task = await tx.task.findUniqueOrThrow({ where: { id: taskId } });
  let resolvedNoteRentalId: string | null = null;

  if (task.sourceRentalNoteId) {
    const noteUpdate = await tx.rentalNote.updateMany({
      where: { id: task.sourceRentalNoteId, resolvedAt: null },
      data: {
        resolvedById: user.id,
        resolvedByName: user.name ?? user.email ?? "Desconocido",
        resolvedAt: new Date(),
      },
    });
    if (noteUpdate.count > 0) {
      const note = await tx.rentalNote.findUniqueOrThrow({
        where: { id: task.sourceRentalNoteId },
        select: { rentalId: true },
      });
      resolvedNoteRentalId = note.rentalId;
    }
  }

  if (task.recurrenceId) {
    const recurrence = await tx.taskRecurrence.findUnique({ where: { id: task.recurrenceId } });
    if (recurrence) await generateNextOccurrence(tx, recurrence, task.dueDate ?? new Date());
  }

  return { resolvedNoteRentalId };
}
