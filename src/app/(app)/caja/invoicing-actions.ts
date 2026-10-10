"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { displayName } from "@/lib/user-display";

/**
 * Marca un ingreso "Hay que facturar" como ya facturado — mismo criterio que
 * "Resolver" en notas de equipo: cualquier rol puede hacerlo. No pide ni
 * guarda ningún dato de la factura en sí (eso es el libro aparte, ver
 * `createInvoice`) — es solo mover el ingreso de "Pendientes" a "Realizados"
 * en Caja → Facturación.
 */
export async function markCashMovementInvoiced(id: string) {
  const user = await requireUser();
  const existing = await prisma.cashMovement.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) throw new Error("Movimiento no encontrado");
  if (!existing.needsInvoice) throw new Error("Este movimiento no está marcado para facturar.");
  if (existing.invoicedAt) return; // ya estaba facturado — no-op, evita un doble click rompiendo algo

  await prisma.cashMovement.update({
    where: { id },
    data: { invoicedAt: new Date(), invoicedById: user.id, invoicedByName: displayName(user) },
  });
  revalidatePath("/caja");
}

/** Por si se marcó facturado por error. Vuelve a "Pendientes". */
export async function unmarkCashMovementInvoiced(id: string) {
  await requireUser();
  const existing = await prisma.cashMovement.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) throw new Error("Movimiento no encontrado");
  if (!existing.invoicedAt) return;

  await prisma.cashMovement.update({
    where: { id },
    data: { invoicedAt: null, invoicedById: null, invoicedByName: null },
  });
  revalidatePath("/caja");
}

const createInvoiceSchema = z.object({
  amount: z.number().positive(),
  currency: z.enum(["ars", "usd"]).default("ars"),
  date: z
    .string()
    .refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v), "Fecha inválida"),
  razonSocial: z.string().trim().min(1, "Hace falta el nombre o razón social").max(200),
  cuit: z.string().trim().min(1, "Hace falta el CUIT").max(20),
});

export type CreateInvoiceResult = { ok: true } | { ok: false; error: string };

/**
 * Cargar una factura: registro suelto, sin vínculo formal con los ingresos
 * marcados "Hay que facturar" (ver el comentario del modelo `Invoice` en el
 * schema) — es simplemente una planilla de lo emitido.
 */
export async function createInvoice(input: unknown): Promise<CreateInvoiceResult> {
  const user = await requireUser();
  const parsed = createInvoiceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const { amount, currency, date, razonSocial, cuit } = parsed.data;

  await prisma.invoice.create({
    data: {
      amount,
      currency,
      date: new Date(`${date}T00:00:00.000Z`),
      razonSocial,
      cuit,
      createdById: user.id,
      createdByName: displayName(user),
    },
  });

  revalidatePath("/caja");
  return { ok: true };
}

/** Borrado simple — es un libro de referencia, no plata real: si se cargó mal, se borra y se carga de nuevo. */
export async function deleteInvoice(id: string) {
  await requireUser();
  await prisma.invoice.delete({ where: { id } }).catch(() => null);
  revalidatePath("/caja");
}
