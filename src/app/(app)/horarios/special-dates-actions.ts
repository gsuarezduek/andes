"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { displayName } from "@/lib/user-display";
import { isDateKey, keyToDate } from "@/lib/rooms/dates";

export type AddSpecialDatesResult = { ok: true; created: number } | { ok: false; error: string };

const addSchema = z.object({
  dates: z
    .array(z.string().refine(isDateKey, "Fecha inválida"))
    .min(1, "Agregá al menos un día")
    .max(60),
  label: z.string().trim().min(1, "Hace falta un motivo").max(120),
});

/**
 * Carga uno o varios días especiales (admin). Upsert por fecha: si ya había
 * un motivo cargado ese día, lo reemplaza — no hace falta borrar y recargar
 * para corregirlo.
 */
export async function addSpecialDates(input: z.input<typeof addSchema>): Promise<AddSpecialDatesResult> {
  const admin = await requireAdmin();
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const { dates, label } = parsed.data;
  const actorName = displayName(admin);

  await prisma.$transaction(async (tx) => {
    for (const key of new Set(dates)) {
      const date = keyToDate(key);
      await tx.specialDate.upsert({
        where: { date },
        create: { date, label, createdById: admin.id, createdByName: actorName },
        update: { label, createdById: admin.id, createdByName: actorName },
      });
    }
  });

  revalidatePath("/horarios");
  revalidatePath("/calendar");
  revalidatePath("/");
  return { ok: true, created: new Set(dates).size };
}

export type DeleteSpecialDateResult = { ok: true } | { ok: false; error: string };

export async function deleteSpecialDate(id: string): Promise<DeleteSpecialDateResult> {
  await requireAdmin();
  if (!id) return { ok: false, error: "Datos inválidos" };
  await prisma.specialDate.delete({ where: { id } }).catch(() => null);
  revalidatePath("/horarios");
  revalidatePath("/calendar");
  revalidatePath("/");
  return { ok: true };
}
