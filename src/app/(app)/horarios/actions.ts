"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { displayName } from "@/lib/user-display";
import { addDaysToKey } from "@/lib/rooms/ical";
import { isDateKey, keyToDate } from "@/lib/rooms/dates";
import { SHIFTS, weekStartOf } from "@/lib/schedule";

export type SaveScheduleResult = { ok: true; changed: number } | { ok: false; error: string };

const inputSchema = z.object({
  weekStart: z.string().refine(isDateKey, "Semana inválida"),
  changes: z
    .array(
      z.object({
        userId: z.string().min(1),
        date: z.string().refine(isDateKey, "Fecha inválida"),
        // null = dejar el día libre
        shift: z.enum(SHIFTS).nullable(),
      }),
    )
    .max(7 * 200),
});

/**
 * Guarda los cambios de horario de una semana (solo admin). Recibe únicamente
 * las celdas que cambiaron; las que ya están igual no se tocan ni se registran.
 * Cada cambio real queda en `ShiftChange` (quién, cuándo, de qué a qué).
 */
export async function saveWeekSchedule(input: z.input<typeof inputSchema>): Promise<SaveScheduleResult> {
  const admin = await requireAdmin();
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const { changes } = parsed.data;
  const weekStart = weekStartOf(parsed.data.weekStart);
  const weekEnd = addDaysToKey(weekStart, 6);

  if (changes.some((c) => c.date < weekStart || c.date > weekEnd)) {
    return { ok: false, error: "Hay una fecha fuera de la semana." };
  }
  const userIds = [...new Set(changes.map((c) => c.userId))];
  const users = await prisma.user.findMany({ where: { id: { in: userIds }, hasSchedule: true }, select: { id: true, name: true } });
  const byId = new Map(users.map((u) => [u.id, u.name]));
  if (userIds.some((id) => !byId.has(id))) {
    return { ok: false, error: "Alguien de la lista ya no tiene horario." };
  }

  const actorName = displayName(admin);
  let changed = 0;
  await prisma.$transaction(async (tx) => {
    for (const c of changes) {
      const date = keyToDate(c.date);
      const existing = await tx.shiftAssignment.findUnique({ where: { userId_date: { userId: c.userId, date } } });
      const from = existing?.shift ?? null;
      if (from === c.shift) continue;
      if (c.shift === null) {
        await tx.shiftAssignment.delete({ where: { id: existing!.id } });
      } else {
        await tx.shiftAssignment.upsert({
          where: { userId_date: { userId: c.userId, date } },
          create: { userId: c.userId, date, shift: c.shift },
          update: { shift: c.shift },
        });
      }
      await tx.shiftChange.create({
        data: {
          userId: c.userId,
          userName: byId.get(c.userId)!,
          date,
          fromShift: from,
          toShift: c.shift,
          changedById: admin.id,
          changedByName: actorName,
        },
      });
      changed++;
    }
  });

  revalidatePath("/horarios");
  revalidatePath("/");
  return { ok: true, changed };
}
