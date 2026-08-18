"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { mendozaWallTimeToUtc } from "@/lib/datetime";

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
});

function parseTaskForm(formData: FormData) {
  const parsed = taskFormSchema.parse({
    text: formData.get("text"),
    priority: formData.get("priority") || "normal",
    dueDate: emptyToNull(formData.get("dueDate")),
    assignedToId: emptyToNull(formData.get("assignedToId")),
    vehicleId: emptyToNull(formData.get("vehicleId")),
  });
  return {
    text: parsed.text,
    priority: parsed.priority,
    dueDate: parsed.dueDate ? mendozaWallTimeToUtc(`${parsed.dueDate}T00:00`) : null,
    assignedToId: parsed.assignedToId,
    vehicleId: parsed.vehicleId,
  };
}

export async function createTask(formData: FormData) {
  const user = await requireUser();
  const data = parseTaskForm(formData);
  await prisma.task.create({ data: { ...data, createdById: user.id } });
  revalidatePath("/tasks");
  revalidatePath("/");
}

export async function completeTask(id: string) {
  const user = await requireUser();
  await prisma.task.update({
    where: { id },
    data: { status: "done", completedById: user.id, completedAt: new Date() },
  });
  revalidatePath("/tasks");
  revalidatePath("/");
}

async function assertCanEditTask(taskId: string, user: { id: string; role: UserRole }) {
  const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
  if (task.createdById !== user.id && user.role !== "admin") {
    throw new Error("Solo quien creó la tarea o un admin puede editarla.");
  }
}

export async function updateTask(id: string, formData: FormData) {
  const user = await requireUser();
  await assertCanEditTask(id, user);
  const data = parseTaskForm(formData);
  await prisma.task.update({ where: { id }, data });
  revalidatePath("/tasks");
  revalidatePath("/");
}

export async function deleteTask(id: string) {
  const user = await requireUser();
  await assertCanEditTask(id, user);
  await prisma.task.delete({ where: { id } });
  revalidatePath("/tasks");
  revalidatePath("/");
}
