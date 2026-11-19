import "server-only";
import type { CashMovement, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { CashMovementFieldChange } from "@/lib/cash";
import { diffDescriptionAndAmount } from "@/lib/movement-audit";
import { currencyLabels } from "@/lib/currency";
import { syncCommission, syncExpenseCommission, deleteCommissionOf } from "@/lib/commissions-sync";
import { syncAutoInvoice } from "@/lib/auto-invoice";
import { invoicedChangeError } from "@/lib/invoicing-rules";
import { BITCOIN_ACCOUNT_ERROR } from "@/lib/account-transfers";
import { autoUnverifyRental } from "@/lib/rental-verification-server";
import { autoUnverifyRoomBooking } from "@/lib/room-booking-verification-server";
import type { MovementEditInput, MovementEditSnapshot } from "@/lib/cash-change-request";

/**
 * Edición y borrado de un ingreso/egreso de Caja, compartidos entre el camino
 * directo (un admin) y la aprobación de un pedido de un empleado
 * (`CashMovementChangeRequest`). Un error de validación es un
 * `MovementEditError`: su mensaje es para mostrarle al usuario.
 */
export class MovementEditError extends Error {}

type Tx = Prisma.TransactionClient;
type Actor = { id: string | null; name: string };

export function movementSnapshot(m: CashMovement): MovementEditSnapshot {
  return {
    description: m.description,
    amount: Number(m.amount),
    currency: m.currency,
    paymentMethodId: m.paymentMethodId,
    paymentMethodNote: m.paymentMethodNote,
    recipientPaymentMethodId: m.recipientPaymentMethodId,
    recipientPaymentMethodNote: m.recipientPaymentMethodNote,
    categoryId: m.categoryId,
  };
}

export type ResolvedMovementEdit = {
  data: Prisma.CashMovementUncheckedUpdateInput;
  changes: CashMovementFieldChange[];
  commissionInputsChanged: boolean;
  accountChanged: boolean;
};

/** Valida lo pedido contra el movimiento y calcula qué cambia (sin escribir nada). */
export async function resolveMovementEdit(existing: CashMovement, input: MovementEditInput): Promise<ResolvedMovementEdit> {
  const { description, amount, currency, paymentMethodId, paymentMethodNote } = input;

  const invoicedError = invoicedChangeError(existing.invoicedAt != null, {
    account: existing.paymentMethodId !== paymentMethodId,
    amount: Number(existing.amount) !== amount,
    currency: existing.currency !== currency,
  });
  if (invoicedError) throw new MovementEditError(invoicedError);

  const method = await prisma.paymentMethod.findUnique({ where: { id: paymentMethodId } });
  if (!method) throw new MovementEditError("Medio de pago inválido.");
  if (method.isBitcoin) throw new MovementEditError(BITCOIN_ACCOUNT_ERROR);
  if (method.requiresNote && !paymentMethodNote) {
    throw new MovementEditError("Este medio de pago requiere indicar a dónde fue.");
  }
  const nextNote = method.requiresNote ? (paymentMethodNote ?? null) : null;

  let recipient: { id: string; name: string; requiresNote: boolean } | null = null;
  if (existing.type === "expense" && input.recipientPaymentMethodId) {
    const found = await prisma.paymentMethod.findUnique({ where: { id: input.recipientPaymentMethodId } });
    if (!found) throw new MovementEditError("Destino inválido.");
    if (found.ownership === "own") throw new MovementEditError("El destino de un egreso tiene que ser una cuenta ajena.");
    if (found.requiresNote && !input.recipientPaymentMethodNote) {
      throw new MovementEditError("Este destino requiere indicar a dónde fue.");
    }
    recipient = found;
  }
  const nextRecipientNote = recipient?.requiresNote ? (input.recipientPaymentMethodNote ?? null) : null;

  // La categoría solo aplica a un Egreso — en un Ingreso siempre queda null.
  let category: { id: string; name: string } | null = null;
  if (existing.type === "expense" && input.categoryId) {
    category = await prisma.cashMovementCategory.findUnique({
      where: { id: input.categoryId },
      select: { id: true, name: true },
    });
    if (!category) throw new MovementEditError("Categoría inválida.");
  }

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
  if ((existing.categoryName ?? "") !== (category?.name ?? "")) {
    changes.push({ field: "Categoría", from: existing.categoryName ?? "—", to: category?.name ?? "—" });
  }

  return {
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
      categoryId: category?.id ?? null,
      categoryName: category?.name ?? null,
    },
    changes,
    // Solo si cambió lo que la comisión depende (monto, moneda o cuenta) se
    // recalcula: editar el detalle de un movimiento viejo no debe generarle
    // una comisión retroactiva.
    commissionInputsChanged:
      Number(existing.amount) !== amount || existing.currency !== currency || existing.paymentMethodId !== method.id,
    accountChanged: existing.paymentMethodId !== method.id,
  };
}

/**
 * Escribe una edición ya resuelta. `editor` es quien la hizo (o la pidió);
 * `approver`, si vino de un pedido, quien la aprobó — es también quien queda
 * como autor de los cambios derivados (comisión).
 */
export async function applyMovementEdit(
  tx: Tx,
  existing: CashMovement,
  resolved: ResolvedMovementEdit,
  editor: Actor,
  approver?: Actor,
) {
  const actor = approver ?? editor;
  await tx.cashMovement.update({ where: { id: existing.id }, data: resolved.data });
  await tx.cashMovementEdit.create({
    data: {
      cashMovementId: existing.id,
      action: "updated",
      changes: resolved.changes,
      editedById: editor.id,
      editedByName: editor.name,
      approvedByName: approver?.name ?? null,
    },
  });
  if (resolved.commissionInputsChanged && actor.id) {
    const commissionActor = { id: actor.id, name: actor.name };
    if (existing.type === "income") await syncCommission(tx, existing.id, commissionActor);
    else if (existing.type === "expense") await syncExpenseCommission(tx, existing.id, commissionActor);
  }
  // Solo si cambió la cuenta: entra o sale de Facturación según la nueva.
  if (resolved.accountChanged) await syncAutoInvoice(tx, existing.id);
  if (existing.rentalId) await autoUnverifyRental(tx, existing.rentalId, "Se editó un movimiento de Caja de la reserva.");
  if (existing.roomBookingId) {
    await autoUnverifyRoomBooking(tx, existing.roomBookingId, "Se editó un movimiento de Caja de la reserva.");
  }
}

/** Valida que el movimiento se pueda eliminar (la UI ya lo bloquea; esta es la guarda de servidor). */
export function assertMovementDeletable(existing: CashMovement) {
  const invoicedError = invoicedChangeError(existing.invoicedAt != null, { delete: true });
  if (invoicedError) throw new MovementEditError(invoicedError);
  if (existing.isGuarantee && existing.type === "income" && existing.guaranteeResolvedAt) {
    throw new MovementEditError("Esta garantía ya se devolvió o se cobró: no se puede eliminar.");
  }
}

/** Soft delete (ver `CashMovement.deletedAt`), con el motivo en el historial. */
export async function applyMovementDelete(
  tx: Tx,
  existing: CashMovement,
  note: string,
  editor: Actor,
  approver?: Actor,
) {
  const actor = approver ?? editor;
  const changes: CashMovementFieldChange[] = [{ field: "Motivo", from: "—", to: note }];
  await tx.cashMovement.update({
    where: { id: existing.id },
    data: { deletedAt: new Date(), deletedById: actor.id, deletedByName: actor.name },
  });
  await tx.cashMovementEdit.create({
    data: {
      cashMovementId: existing.id,
      action: "deleted",
      changes,
      editedById: editor.id,
      editedByName: editor.name,
      approvedByName: approver?.name ?? null,
    },
  });
  // Un pedido que siga pendiente sobre este movimiento ya no tiene sentido.
  await tx.cashMovementChangeRequest.updateMany({
    where: { cashMovementId: existing.id, status: "pending" },
    data: {
      status: "cancelled",
      resolvedAt: new Date(),
      resolvedById: actor.id,
      resolvedByName: actor.name,
      resolutionNote: "Se eliminó el movimiento.",
    },
  });
  // Si este movimiento generó un egreso de comisión, se va con él.
  if (actor.id) await deleteCommissionOf(tx, existing.id, { id: actor.id, name: actor.name });
  if (existing.rentalId) await autoUnverifyRental(tx, existing.rentalId, "Se eliminó un movimiento de Caja de la reserva.");
  if (existing.roomBookingId) {
    await autoUnverifyRoomBooking(tx, existing.roomBookingId, "Se eliminó un movimiento de Caja de la reserva.");
  }
}
