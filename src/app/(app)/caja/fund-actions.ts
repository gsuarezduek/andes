"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { displayName } from "@/lib/user-display";

const createSchema = z.object({
  paymentMethodId: z.string().min(1),
  type: z.enum(["deposit", "withdrawal"]),
  amount: z.coerce.number().positive(),
  currency: z.enum(["ars", "usd"]),
  note: z.string().trim().max(500).default(""),
});

export type FundMovementResult = { error?: string; ok?: boolean };

/**
 * Depósito/retiro de fondos de inversión de una cuenta propia — puramente
 * informativo: no genera un `CashMovement` ni cambia el saldo de Caja de la
 * cuenta (ver `PaymentMethod.hasInvestmentFunds` en el schema). Solo admin,
 * mismo criterio que Saldos.
 */
export async function createFundMovement(_prev: FundMovementResult, formData: FormData): Promise<FundMovementResult> {
  const user = await requireAdmin();
  const parsed = createSchema.safeParse({
    paymentMethodId: formData.get("paymentMethodId"),
    type: formData.get("type"),
    amount: formData.get("amount"),
    currency: formData.get("currency"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) return { error: "Revisá el monto — tiene que ser mayor a cero." };
  const d = parsed.data;

  const account = await prisma.paymentMethod.findUnique({ where: { id: d.paymentMethodId } });
  if (!account || account.ownership !== "own" || !account.hasInvestmentFunds) {
    return { error: "Esta cuenta no tiene fondos de inversión habilitados." };
  }

  await prisma.fundMovement.create({
    data: {
      paymentMethodId: d.paymentMethodId,
      type: d.type,
      amount: d.amount,
      currency: d.currency,
      note: d.note || null,
      createdByName: displayName(user),
    },
  });

  revalidatePath("/caja/saldos/[id]", "page");
  return { ok: true };
}

/**
 * Elimina un movimiento de fondos mal cargado (soft delete, motivo
 * obligatorio) — no se edita: se elimina y se vuelve a cargar, mismo criterio
 * que `AccountTransfer`.
 */
export async function deleteFundMovement(id: string, formData: FormData) {
  const user = await requireAdmin();
  const note = z.string().trim().min(1).max(300).parse(formData.get("note"));

  const existing = await prisma.fundMovement.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) throw new Error("Movimiento no encontrado");

  await prisma.fundMovement.update({
    where: { id },
    data: { deletedAt: new Date(), deletedByName: displayName(user), deleteNote: note },
  });

  revalidatePath("/caja/saldos/[id]", "page");
}
