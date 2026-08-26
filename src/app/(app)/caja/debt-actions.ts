"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, requireAdmin } from "@/lib/auth-helpers";
import type { CashMovementFieldChange } from "@/lib/cash";
import { diffDescriptionAndAmount } from "@/lib/movement-audit";
import { currencyLabels } from "@/lib/currency";

const createDebtSchema = z.object({
  description: z.string().trim().min(1).max(500),
  amount: z.coerce.number().positive(),
  currency: z.enum(["ars", "usd"]).default("ars"),
  accountId: z.string().min(1),
});

// Deuda con una cuenta ajena (proveedor o asociado): cargo a cuenta
// corriente sin salida de plata todavía (CashMovement con type="debt", sin
// Origen — ver `src/lib/third-party-accounts.ts`). Cualquier rol puede
// cargarla, igual que un Ingreso/Egreso. La cuenta (Destino) queda fija al
// cargarla — si está mal, se borra y se carga de nuevo (mismo criterio que
// tipo/reserva en CashMovement).
export async function createDebtMovement(formData: FormData) {
  const user = await requireUser();
  const { description, amount, currency, accountId } = createDebtSchema.parse({
    description: formData.get("description"),
    amount: formData.get("amount"),
    currency: formData.get("currency") || undefined,
    accountId: formData.get("accountId"),
  });

  const account = await prisma.paymentMethod.findUnique({ where: { id: accountId } });
  if (!account || (account.ownership !== "provider" && account.ownership !== "associate")) {
    throw new Error("La cuenta elegida no es válida.");
  }

  await prisma.cashMovement.create({
    data: {
      type: "debt",
      description,
      amount,
      currency,
      paymentMethodName: "",
      recipientPaymentMethodId: account.id,
      recipientPaymentMethodName: account.name,
      createdById: user.id,
    },
  });

  revalidatePath("/caja");
}

const updateDebtSchema = z.object({
  description: z.string().trim().min(1).max(500),
  amount: z.coerce.number().positive(),
  currency: z.enum(["ars", "usd"]).default("ars"),
});

// Corrección de un error de carga (detalle, monto, moneda). Solo admin. La
// cuenta no se edita (ver arriba). Cada cambio real queda auditado en
// CashMovementEdit; si no cambió nada, no se registra nada.
export async function updateDebtMovement(id: string, formData: FormData) {
  const user = await requireAdmin();
  const { description, amount, currency } = updateDebtSchema.parse({
    description: formData.get("description"),
    amount: formData.get("amount"),
    currency: formData.get("currency") || undefined,
  });

  const existing = await prisma.cashMovement.findUnique({ where: { id } });
  if (!existing || existing.deletedAt || existing.type !== "debt") throw new Error("Movimiento no encontrado");

  const changes: CashMovementFieldChange[] = diffDescriptionAndAmount(existing, { description, amount }, "Detalle");
  if (existing.currency !== currency) {
    changes.push({ field: "Moneda", from: currencyLabels[existing.currency], to: currencyLabels[currency] });
  }
  if (changes.length === 0) return;

  await prisma.$transaction([
    prisma.cashMovement.update({ where: { id }, data: { description, amount, currency } }),
    prisma.cashMovementEdit.create({
      data: { cashMovementId: id, action: "updated", changes, editedById: user.id },
    }),
  ]);

  revalidatePath("/caja");
}

// Borrado de una deuda mal cargada (cuenta equivocada, monto mal, etc.).
// Solo admin. Soft delete, mismo criterio que el resto de Caja.
export async function deleteDebtMovement(id: string, formData: FormData) {
  const user = await requireAdmin();
  const note = z.string().trim().min(1).max(300).parse(formData.get("note"));

  const existing = await prisma.cashMovement.findUnique({ where: { id } });
  if (!existing || existing.deletedAt || existing.type !== "debt") throw new Error("Movimiento no encontrado");

  await prisma.$transaction([
    prisma.cashMovement.update({ where: { id }, data: { deletedAt: new Date(), deletedById: user.id } }),
    prisma.cashMovementEdit.create({
      data: {
        cashMovementId: id,
        action: "deleted",
        changes: [{ field: "Motivo", from: "—", to: note }],
        editedById: user.id,
      },
    }),
  ]);

  revalidatePath("/caja");
}
