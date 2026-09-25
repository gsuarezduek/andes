"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, requireAdmin } from "@/lib/auth-helpers";
import { displayName } from "@/lib/user-display";
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
      createdByName: displayName(user),
    },
  });

  revalidatePath("/caja");
}

const updateAccountMovementSchema = z.object({
  description: z.string().trim().min(1).max(500),
  amount: z.coerce.number().positive(),
  currency: z.enum(["ars", "usd"]).default("ars"),
  // "payment" = Egreso (Pago) con Origen obligatorio; "debt" = Deuda, sin Origen.
  kind: z.enum(["payment", "debt"]),
  paymentMethodId: z.string().optional(),
  paymentMethodNote: z.string().trim().max(300).optional(),
  // Cuenta (destino) — opcional: si no llega, se deja la que tenía.
  recipientPaymentMethodId: z.string().optional(),
});

/**
 * Corrección de un movimiento de cuenta corriente (proveedor o asociado) que
 * es Deuda o Pago (Egreso) — detalle, monto, moneda, y el tipo mismo: un
 * toggle Pago/Deuda permite arreglar un movimiento mal cargado (un empleado
 * anotó un pago que en realidad era una deuda, o viceversa) sin borrarlo. Al
 * pasar a Pago hace falta elegir el Origen (de dónde salió la plata); al
 * pasar a Deuda se lo saca. Solo admin. La cuenta (Destino) se puede cambiar
 * pero solo dentro de la misma entidad (la principal y sus subcuentas, ej. de
 * "Gastón BBVA" a "Gastón Efectivo") — el saldo se resuelve siempre a la
 * principal, así que no cambia; pasar el movimiento a OTRA entidad sigue
 * siendo "borrar y cargar de nuevo". Cada cambio
 * real queda auditado en CashMovementEdit; si no cambió nada, no se registra
 * nada.
 */
export async function updateAccountMovement(id: string, formData: FormData) {
  const user = await requireAdmin();
  const { description, amount, currency, kind, paymentMethodId, paymentMethodNote, recipientPaymentMethodId } =
    updateAccountMovementSchema.parse({
      description: formData.get("description"),
      amount: formData.get("amount"),
      currency: formData.get("currency") || undefined,
      kind: formData.get("kind"),
      paymentMethodId: formData.get("paymentMethodId") || undefined,
      paymentMethodNote: formData.get("paymentMethodNote") || undefined,
      recipientPaymentMethodId: formData.get("recipientPaymentMethodId") || undefined,
    });

  const existing = await prisma.cashMovement.findUnique({ where: { id } });
  if (
    !existing ||
    existing.deletedAt ||
    (existing.type !== "debt" && existing.type !== "expense") ||
    !existing.recipientPaymentMethodId
  ) {
    throw new Error("Movimiento no encontrado");
  }

  // Cuenta (destino): solo dentro de la misma entidad que la actual.
  let nextRecipient = { id: existing.recipientPaymentMethodId, name: existing.recipientPaymentMethodName };
  if (recipientPaymentMethodId && recipientPaymentMethodId !== existing.recipientPaymentMethodId) {
    const [current, candidate] = await Promise.all([
      prisma.paymentMethod.findUnique({ where: { id: existing.recipientPaymentMethodId } }),
      prisma.paymentMethod.findUnique({ where: { id: recipientPaymentMethodId } }),
    ]);
    const principalId = current?.parentId ?? current?.id;
    if (!candidate || !principalId || (candidate.id !== principalId && candidate.parentId !== principalId)) {
      throw new Error("La cuenta elegida no pertenece a la misma entidad.");
    }
    nextRecipient = { id: candidate.id, name: candidate.name };
  }

  let origin: { id: string; name: string; requiresNote: boolean } | null = null;
  if (kind === "payment") {
    if (!paymentMethodId) throw new Error("Elegí de dónde sale la plata.");
    const found = await prisma.paymentMethod.findUnique({ where: { id: paymentMethodId } });
    if (!found) throw new Error("Origen inválido");
    if (found.requiresNote && !paymentMethodNote) {
      throw new Error("Este medio de pago requiere indicar a dónde fue.");
    }
    origin = found;
  }
  const nextType = kind === "payment" ? "expense" : "debt";
  const nextPaymentMethodName = origin?.name ?? "";
  const nextPaymentMethodNote = origin?.requiresNote ? (paymentMethodNote ?? null) : null;

  const changes: CashMovementFieldChange[] = diffDescriptionAndAmount(existing, { description, amount }, "Detalle");
  if (existing.currency !== currency) {
    changes.push({ field: "Moneda", from: currencyLabels[existing.currency], to: currencyLabels[currency] });
  }
  if (existing.type !== nextType) {
    changes.push({
      field: "Tipo",
      from: existing.type === "debt" ? "Deuda" : "Pago",
      to: kind === "payment" ? "Pago" : "Deuda",
    });
  }
  if ((existing.paymentMethodName || "—") !== (nextPaymentMethodName || "—")) {
    changes.push({ field: "Origen", from: existing.paymentMethodName || "—", to: nextPaymentMethodName || "—" });
  }
  if (nextRecipient.id !== existing.recipientPaymentMethodId) {
    changes.push({ field: "Cuenta", from: existing.recipientPaymentMethodName ?? "—", to: nextRecipient.name ?? "—" });
  }
  if (changes.length === 0) return;

  await prisma.$transaction([
    prisma.cashMovement.update({
      where: { id },
      data: {
        recipientPaymentMethodId: nextRecipient.id,
        recipientPaymentMethodName: nextRecipient.name,
        type: nextType,
        description,
        amount,
        currency,
        paymentMethodId: origin?.id ?? null,
        paymentMethodName: nextPaymentMethodName,
        paymentMethodNote: nextPaymentMethodNote,
      },
    }),
    prisma.cashMovementEdit.create({
      data: { cashMovementId: id, action: "updated", changes, editedById: user.id, editedByName: displayName(user) },
    }),
  ]);

  revalidatePath("/caja");
}

// Borrado de un movimiento de cuenta corriente mal cargado (Deuda o Pago).
// Solo admin. Soft delete, mismo criterio que el resto de Caja.
export async function deleteAccountMovement(id: string, formData: FormData) {
  const user = await requireAdmin();
  const note = z.string().trim().min(1).max(300).parse(formData.get("note"));

  const existing = await prisma.cashMovement.findUnique({ where: { id } });
  if (
    !existing ||
    existing.deletedAt ||
    (existing.type !== "debt" && existing.type !== "expense") ||
    !existing.recipientPaymentMethodId
  ) {
    throw new Error("Movimiento no encontrado");
  }

  await prisma.$transaction([
    prisma.cashMovement.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: user.id, deletedByName: displayName(user) },
    }),
    prisma.cashMovementEdit.create({
      data: {
        cashMovementId: id,
        action: "deleted",
        changes: [{ field: "Motivo", from: "—", to: note }],
        editedById: user.id,
        editedByName: displayName(user),
      },
    }),
  ]);

  revalidatePath("/caja");
}
