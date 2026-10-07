"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { RecurrenceFreq, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { displayName } from "@/lib/user-display";
import { mendozaWallTimeToUtc } from "@/lib/datetime";
import { ruleFromDueDate } from "@/lib/task-recurrence";
import { completeTaskTx, generateNextOccurrence } from "@/lib/task-completion";

function emptyToNull(v: FormDataEntryValue | null): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
}

const taskFormSchema = z.object({
  text: z.string().trim().min(1).max(500),
  priority: z.enum(["normal", "high"]),
  dueDate: z.string().nullable(),
  assignedToId: z.string().nullable(),
  vehicleId: z.string().nullable(),
  rentalId: z.string().nullable(),
});

async function parseTaskForm(formData: FormData) {
  const parsed = taskFormSchema.parse({
    text: formData.get("text"),
    priority: formData.get("priority") || "normal",
    dueDate: emptyToNull(formData.get("dueDate")),
    assignedToId: emptyToNull(formData.get("assignedToId")),
    vehicleId: emptyToNull(formData.get("vehicleId")),
    rentalId: emptyToNull(formData.get("rentalId")),
  });
  const assignedTo = parsed.assignedToId
    ? await prisma.user.findUnique({ where: { id: parsed.assignedToId }, select: { name: true } })
    : null;
  return {
    text: parsed.text,
    priority: parsed.priority,
    dueDate: parsed.dueDate ? mendozaWallTimeToUtc(`${parsed.dueDate}T00:00`) : null,
    assignedToId: parsed.assignedToId,
    assignedToName: assignedTo?.name ?? null,
    vehicleId: parsed.vehicleId,
    rentalId: parsed.rentalId,
  };
}

const RECURRENCE_FREQS = ["none", "daily", "weekly", "monthly", "yearly"] as const;

const recurrenceFormSchema = z.object({
  freq: z.enum(RECURRENCE_FREQS),
  interval: z.coerce.number().int().min(1).max(365),
});

/**
 * Lee "Repetir" del form (freq + intervalo). El día/semana/mes de la regla
 * NO se elige aparte — se deriva de `dueDate` (ver ruleFromDueDate), así que
 * hace falta una fecha para poder armar la regla.
 */
function parseRecurrenceRule(formData: FormData, dueDate: Date | null) {
  const parsed = recurrenceFormSchema.parse({
    freq: formData.get("recurrenceFreq") || "none",
    interval: formData.get("recurrenceInterval") || 1,
  });
  if (parsed.freq === "none") return null;
  if (!dueDate) {
    throw new Error("Una tarea que se repite necesita una fecha.");
  }
  return ruleFromDueDate(parsed.freq as RecurrenceFreq, parsed.interval, dueDate);
}

export async function createTask(formData: FormData) {
  const user = await requireUser();
  const data = await parseTaskForm(formData);
  const rule = parseRecurrenceRule(formData, data.dueDate);

  if (rule) {
    await prisma.$transaction(async (tx) => {
      const recurrence = await tx.taskRecurrence.create({
        data: {
          ...rule,
          text: data.text,
          priority: data.priority,
          assignedToId: data.assignedToId,
          assignedToName: data.assignedToName,
          vehicleId: data.vehicleId,
          createdById: user.id,
          createdByName: displayName(user),
        },
      });
      await tx.task.create({
        data: { ...data, recurrenceId: recurrence.id, createdById: user.id, createdByName: displayName(user) },
      });
    });
  } else {
    await prisma.task.create({ data: { ...data, createdById: user.id, createdByName: displayName(user) } });
  }
  revalidatePath("/tasks");
  revalidatePath("/");
}

export async function completeTask(id: string) {
  const user = await requireUser();
  const { resolvedNoteRentalId } = await prisma.$transaction((tx) => completeTaskTx(tx, id, user));
  revalidatePath("/tasks");
  revalidatePath("/");
  // La tarea venía de una nota de equipo mencionada (@) — completarla
  // resolvió esa nota también, así que hay que refrescar donde se muestra
  // el contador de notas sin resolver (mismo criterio que resolveRentalNote).
  if (resolvedNoteRentalId) {
    revalidatePath(`/rentals/${resolvedNoteRentalId}`);
    revalidatePath("/rentals");
    revalidatePath("/calendar");
  }
}

async function assertCanEditTask(taskId: string, user: { id: string; role: UserRole }) {
  const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
  if (task.createdById !== user.id && user.role !== "admin") {
    throw new Error("Solo quien creó la tarea o un admin puede editarla.");
  }
}

/**
 * `scope` ("instance" | "series") solo importa si la tarea es parte de una
 * serie: "series" además actualiza la plantilla (`TaskRecurrence`) — texto,
 * prioridad, asignado, vehículo y la regla (frecuencia/intervalo) — para que
 * las futuras ocurrencias generadas también reflejen el cambio. "instance"
 * (default) solo toca esta fila, la serie sigue generando con los valores
 * de siempre.
 */
export async function updateTask(id: string, formData: FormData) {
  const user = await requireUser();
  await assertCanEditTask(id, user);
  const data = await parseTaskForm(formData);
  const scope = formData.get("scope") === "series" ? "series" : "instance";
  const task = await prisma.task.findUniqueOrThrow({ where: { id } });

  if (scope === "series" && task.recurrenceId) {
    const rule = parseRecurrenceRule(formData, data.dueDate);
    await prisma.$transaction([
      prisma.task.update({ where: { id }, data }),
      prisma.taskRecurrence.update({
        where: { id: task.recurrenceId },
        data: {
          text: data.text,
          priority: data.priority,
          assignedToId: data.assignedToId,
          assignedToName: data.assignedToName,
          vehicleId: data.vehicleId,
          ...(rule ?? {}),
        },
      }),
    ]);
  } else {
    await prisma.task.update({ where: { id }, data });
  }
  revalidatePath("/tasks");
  revalidatePath("/");
}

/**
 * Sin marcar "Detener la repetición": borra esta ocurrencia y, si la serie
 * sigue activa, genera de inmediato la próxima (si no, al no completarse
 * nunca esta fila, la serie quedaría trabada para siempre — la próxima solo
 * se genera al completar o al borrar). Marcando el checkbox: borra esta fila
 * y detiene la serie (no se genera ninguna más).
 */
export async function deleteTask(id: string, formData: FormData) {
  const user = await requireUser();
  await assertCanEditTask(id, user);
  const task = await prisma.task.findUniqueOrThrow({ where: { id } });
  const stopSeries = formData.get("stopSeries") === "on";

  await prisma.$transaction(async (tx) => {
    await tx.task.delete({ where: { id } });
    if (!task.recurrenceId) return;

    if (stopSeries) {
      await tx.taskRecurrence.update({ where: { id: task.recurrenceId }, data: { active: false } });
      return;
    }
    const recurrence = await tx.taskRecurrence.findUnique({ where: { id: task.recurrenceId } });
    if (!recurrence) return;
    await generateNextOccurrence(tx, recurrence, task.dueDate ?? new Date());
  });
  revalidatePath("/tasks");
  revalidatePath("/");
}
