"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, requireAdmin } from "@/lib/auth-helpers";
import type { CashMovementFieldChange } from "@/lib/cash";
import { diffDescriptionAndAmount } from "@/lib/movement-audit";
import { computeBalance, roundMoney, type ContractPricing } from "@/lib/contract";
import { currencyLabels } from "@/lib/currency";

const createMovementSchema = z.object({
  description: z.string().trim().min(1).max(500),
  amount: z.coerce.number().positive(),
  currency: z.enum(["ars", "usd"]).default("ars"),
  paymentMethodId: z.string().min(1),
  paymentMethodNote: z.string().trim().max(300).optional(),
  recipientPaymentMethodId: z.string().optional(),
  recipientPaymentMethodNote: z.string().trim().max(300).optional(),
  rentalId: z.string().optional(),
});

// Movimiento de Caja: ingreso o egreso. Cualquier rol puede cargarlo — la
// restricción de "solo agregar" para empleados es de UI (no ven el detalle),
// no de permisos de escritura. Editar/eliminar es solo para admin (ver abajo).
//
// En un Egreso, `paymentMethodId` es el Origen (obligatorio, cualquier cuenta
// — propia o ajena) y `recipientPaymentMethodId` el Destino (opcional, tiene
// que ser una cuenta ajena si se manda). En un Ingreso no hay esa distinción —
// el medio puede ser cualquiera, como hasta ahora.
export async function createCashMovement(type: "income" | "expense", formData: FormData) {
  const user = await requireUser();
  const {
    description,
    amount,
    currency,
    paymentMethodId,
    paymentMethodNote,
    recipientPaymentMethodId,
    recipientPaymentMethodNote,
    rentalId,
  } = createMovementSchema.parse({
    description: formData.get("description"),
    amount: formData.get("amount"),
    currency: formData.get("currency") || undefined,
    paymentMethodId: formData.get("paymentMethodId"),
    paymentMethodNote: formData.get("paymentMethodNote") || undefined,
    recipientPaymentMethodId: formData.get("recipientPaymentMethodId") || undefined,
    recipientPaymentMethodNote: formData.get("recipientPaymentMethodNote") || undefined,
    rentalId: formData.get("rentalId") || undefined,
  });

  const method = await prisma.paymentMethod.findUnique({ where: { id: paymentMethodId } });
  if (!method) throw new Error("Medio de pago inválido");
  if (method.requiresNote && !paymentMethodNote) {
    throw new Error("Este medio de pago requiere indicar a dónde fue.");
  }

  let recipient: { id: string; name: string; requiresNote: boolean } | null = null;
  if (type === "expense" && recipientPaymentMethodId) {
    const found = await prisma.paymentMethod.findUnique({ where: { id: recipientPaymentMethodId } });
    if (!found) throw new Error("Destino inválido");
    if (found.ownership === "own") throw new Error("El destino de un egreso tiene que ser una cuenta ajena.");
    if (found.requiresNote && !recipientPaymentMethodNote) {
      throw new Error("Este destino requiere indicar a dónde fue.");
    }
    recipient = found;
  }

  await prisma.cashMovement.create({
    data: {
      type,
      description,
      amount,
      currency,
      paymentMethodId: method.id,
      paymentMethodName: method.name,
      paymentMethodNote: method.requiresNote ? paymentMethodNote : null,
      recipientPaymentMethodId: recipient?.id ?? null,
      recipientPaymentMethodName: recipient?.name ?? null,
      recipientPaymentMethodNote: recipient?.requiresNote ? recipientPaymentMethodNote : null,
      rentalId: rentalId || null,
      createdById: user.id,
    },
  });

  revalidatePath("/caja");
}

const updateMovementSchema = z.object({
  description: z.string().trim().min(1).max(500),
  amount: z.coerce.number().positive(),
  currency: z.enum(["ars", "usd"]).default("ars"),
  paymentMethodId: z.string().min(1),
  paymentMethodNote: z.string().trim().max(300).optional(),
  recipientPaymentMethodId: z.string().optional(),
  recipientPaymentMethodNote: z.string().trim().max(300).optional(),
});

// Corrección de un error de carga (monto, medio de pago, detalle, y en un
// Egreso también Origen/Destino). Solo admin. Tipo y reserva vinculada no se
// editan — si están mal, se borra el movimiento y se carga de nuevo. Cada
// cambio real queda auditado en CashMovementEdit; si no cambió nada, no se
// registra nada.
export async function updateCashMovement(id: string, formData: FormData) {
  const user = await requireAdmin();
  const {
    description,
    amount,
    currency,
    paymentMethodId,
    paymentMethodNote,
    recipientPaymentMethodId,
    recipientPaymentMethodNote,
  } = updateMovementSchema.parse({
    description: formData.get("description"),
    amount: formData.get("amount"),
    currency: formData.get("currency") || undefined,
    paymentMethodId: formData.get("paymentMethodId"),
    paymentMethodNote: formData.get("paymentMethodNote") || undefined,
    recipientPaymentMethodId: formData.get("recipientPaymentMethodId") || undefined,
    recipientPaymentMethodNote: formData.get("recipientPaymentMethodNote") || undefined,
  });

  const existing = await prisma.cashMovement.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) throw new Error("Movimiento no encontrado");

  const method = await prisma.paymentMethod.findUnique({ where: { id: paymentMethodId } });
  if (!method) throw new Error("Medio de pago inválido");
  if (method.requiresNote && !paymentMethodNote) {
    throw new Error("Este medio de pago requiere indicar a dónde fue.");
  }
  const nextNote = method.requiresNote ? (paymentMethodNote ?? null) : null;

  let recipient: { id: string; name: string; requiresNote: boolean } | null = null;
  if (existing.type === "expense" && recipientPaymentMethodId) {
    const found = await prisma.paymentMethod.findUnique({ where: { id: recipientPaymentMethodId } });
    if (!found) throw new Error("Destino inválido");
    if (found.ownership === "own") throw new Error("El destino de un egreso tiene que ser una cuenta ajena.");
    if (found.requiresNote && !recipientPaymentMethodNote) {
      throw new Error("Este destino requiere indicar a dónde fue.");
    }
    recipient = found;
  }
  const nextRecipientNote = recipient?.requiresNote ? (recipientPaymentMethodNote ?? null) : null;

  const changes: CashMovementFieldChange[] = diffDescriptionAndAmount(existing, { description, amount }, "Detalle");
  if (existing.currency !== currency) {
    changes.push({ field: "Moneda", from: currencyLabels[existing.currency], to: currencyLabels[currency] });
  }
  if (existing.paymentMethodName !== method.name) {
    const field = existing.type === "expense" ? "Origen" : "Medio de pago";
    changes.push({ field, from: existing.paymentMethodName, to: method.name });
  }
  if ((existing.paymentMethodNote ?? "") !== (nextNote ?? "")) {
    changes.push({ field: "Aclaración", from: existing.paymentMethodNote ?? "—", to: nextNote ?? "—" });
  }
  if ((existing.recipientPaymentMethodName ?? "") !== (recipient?.name ?? "")) {
    changes.push({ field: "Destino", from: existing.recipientPaymentMethodName ?? "—", to: recipient?.name ?? "—" });
  }
  if ((existing.recipientPaymentMethodNote ?? "") !== (nextRecipientNote ?? "")) {
    changes.push({
      field: "Aclaración del destino",
      from: existing.recipientPaymentMethodNote ?? "—",
      to: nextRecipientNote ?? "—",
    });
  }
  if (changes.length === 0) return;

  await prisma.$transaction([
    prisma.cashMovement.update({
      where: { id },
      data: {
        description,
        amount,
        currency,
        paymentMethodId: method.id,
        paymentMethodName: method.name,
        paymentMethodNote: nextNote,
        recipientPaymentMethodId: recipient?.id ?? null,
        recipientPaymentMethodName: recipient?.name ?? null,
        recipientPaymentMethodNote: nextRecipientNote,
      },
    }),
    prisma.cashMovementEdit.create({
      data: { cashMovementId: id, action: "updated", changes, editedById: user.id },
    }),
  ]);

  revalidatePath("/caja");
}

// Borrado de un movimiento mal cargado. Solo admin. Soft delete: la fila
// queda (deletedAt/deletedById) para que el historial de ediciones pueda
// seguir mostrando qué era. El motivo (obligatorio) queda en `changes` para
// que el historial lo muestre junto al resto de la auditoría.
export async function deleteCashMovement(id: string, formData: FormData) {
  const user = await requireAdmin();
  const note = z.string().trim().min(1).max(300).parse(formData.get("note"));

  const existing = await prisma.cashMovement.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) throw new Error("Movimiento no encontrado");

  const changes: CashMovementFieldChange[] = [{ field: "Motivo", from: "—", to: note }];

  await prisma.$transaction([
    prisma.cashMovement.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: user.id },
    }),
    prisma.cashMovementEdit.create({
      data: { cashMovementId: id, action: "deleted", changes, editedById: user.id },
    }),
  ]);

  revalidatePath("/caja");
}

const confirmMethodSchema = z.object({
  paymentMethodId: z.string().min(1),
  note: z.string().trim().max(300).optional(),
});

/**
 * Confirma el medio de pago real de un ingreso importado automáticamente
 * desde VikRentCar (bandera `needsConfirmation` — ver `importBookingPayment`
 * en `sync/booking-upsert.ts`). Cualquier usuario puede hacerlo: es completar
 * un dato que faltaba, no corregir un error de carga (eso sigue siendo edición
 * completa, solo admin, vía `updateCashMovement`). Si la reserva sigue con la
 * línea correspondiente en `pricing.payments`, también se actualiza ahí para
 * que el wizard de entrega la vea ya resuelta.
 *
 * Al importar, el monto crudo de VikRentCar (`totpaid`) queda como base Y
 * como ajustado por igual — recién acá se sabe el medio real, así que si
 * tiene % (ej. recargo de tarjeta) se recalcula la base hacia atrás a partir
 * de lo realmente cobrado (que no cambia — ya es lo que entró a Caja): si el
 * cliente pagó $53 con una tarjeta de +6%, la base pasa a ser $50, y eso —no
 * $53— es lo que cuenta para "Paga"/Saldo (ver `RentalPayment` en contract.ts).
 */
export async function confirmCashMovementPaymentMethod(id: string, formData: FormData) {
  const user = await requireUser();
  const { paymentMethodId, note } = confirmMethodSchema.parse({
    paymentMethodId: formData.get("paymentMethodId"),
    note: formData.get("note") || undefined,
  });

  const existing = await prisma.cashMovement.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) throw new Error("Movimiento no encontrado");
  if (!existing.needsConfirmation) throw new Error("Este movimiento ya está confirmado.");

  const method = await prisma.paymentMethod.findUnique({ where: { id: paymentMethodId } });
  if (!method) throw new Error("Medio de pago inválido");
  if (method.requiresNote && !note) throw new Error("Este medio de pago requiere indicar a dónde fue.");
  const nextNote = method.requiresNote ? (note ?? null) : null;

  await prisma.$transaction(async (tx) => {
    await tx.cashMovement.update({
      where: { id },
      data: {
        paymentMethodId: method.id,
        paymentMethodName: method.name,
        paymentMethodNote: nextNote,
        needsConfirmation: false,
      },
    });
    await tx.cashMovementEdit.create({
      data: {
        cashMovementId: id,
        action: "updated",
        changes: [{ field: "Medio de pago", from: existing.paymentMethodName, to: method.name }],
        editedById: user.id,
      },
    });

    if (existing.rentalId) {
      const rental = await tx.rental.findUnique({ where: { id: existing.rentalId }, select: { pricing: true } });
      const pricing = (rental?.pricing ?? {}) as ContractPricing;
      if (pricing.payments?.some((p) => p.cashMovementId === id)) {
        const pct = method.adjustmentPercent != null ? Number(method.adjustmentPercent) : null;
        const nextPayments = pricing.payments.map((p) => {
          if (p.cashMovementId !== id) return p;
          // adjustedAmount es lo realmente cobrado — no cambia. La base se
          // recalcula hacia atrás con el % del medio recién confirmado (sin
          // %, base = lo cobrado, igual que antes de confirmar).
          const amount = pct ? roundMoney(p.adjustedAmount / (1 + pct / 100)) : p.adjustedAmount;
          return {
            ...p,
            methodId: method.id,
            methodName: method.name,
            adjustmentPercent: pct ?? undefined,
            amount,
            note: nextNote ?? undefined,
            unconfirmed: false,
          };
        });
        const nextPaid = roundMoney(nextPayments.reduce((sum, p) => sum + p.amount, 0));
        const nextPricing: ContractPricing = { ...pricing, payments: nextPayments, paid: nextPaid };
        if (pricing.total != null) {
          nextPricing.balance = computeBalance({ total: pricing.total, sena: pricing.sena, paid: nextPaid }) ?? undefined;
        }
        await tx.rental.update({
          where: { id: existing.rentalId! },
          data: { pricing: nextPricing },
        });
      }
    }
  });

  revalidatePath("/caja");
  if (existing.rentalId) revalidatePath(`/rentals/${existing.rentalId}`);
}
