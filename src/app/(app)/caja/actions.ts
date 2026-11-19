"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { displayName } from "@/lib/user-display";
import { getCashMovementRow, type CashMovementFieldChange, type CashMovementRow } from "@/lib/cash";
import { hasAdminAccess } from "@/lib/user-permissions";
import {
  MovementEditError,
  applyMovementDelete,
  applyMovementEdit,
  assertMovementDeletable,
  movementSnapshot,
  resolveMovementEdit,
} from "@/lib/cash-movement-edit";
import { isEmptyProposal, proposedMovementEdit, type ProposedMovementEdit } from "@/lib/cash-change-request";
import { computeBalance, paidTotal, roundMoney, type ContractPricing } from "@/lib/contract";
import { syncCommission, syncExpenseCommission } from "@/lib/commissions-sync";
import { syncAutoInvoice } from "@/lib/auto-invoice";
import { BITCOIN_ACCOUNT_ERROR } from "@/lib/account-transfers";
import { autoUnverifyRental } from "@/lib/rental-verification-server";
import { autoUnverifyRoomBooking } from "@/lib/room-booking-verification-server";

const createMovementSchema = z.object({
  description: z.string().trim().min(1).max(500),
  amount: z.coerce.number().positive(),
  currency: z.enum(["ars", "usd"]).default("ars"),
  paymentMethodId: z.string().min(1),
  paymentMethodNote: z.string().trim().max(300).optional(),
  recipientPaymentMethodId: z.string().optional(),
  recipientPaymentMethodNote: z.string().trim().max(300).optional(),
  categoryId: z.string().optional(),
  rentalId: z.string().optional(),
  roomBookingId: z.string().optional(),
  invoicingName: z.string().trim().max(200).optional(),
  invoicingCuit: z.string().trim().max(20).optional(),
});

// Movimiento de Caja: ingreso o egreso. Cualquier rol puede cargarlo. Editar
// y eliminar: ver `updateCashMovement`/`deleteCashMovement` (un empleado lo
// pide y queda pendiente de aprobación).
//
// En un Egreso, `paymentMethodId` es el Origen (obligatorio, cualquier cuenta
// — propia o ajena) y `recipientPaymentMethodId` el Destino (opcional, tiene
// que ser una cuenta ajena si se manda). En un Ingreso no hay esa distinción —
// el medio puede ser cualquiera, como hasta ahora.
export async function createCashMovement(type: "income" | "expense", formData: FormData): Promise<CashMovementRow> {
  const user = await requireUser();
  const {
    description,
    amount,
    currency,
    paymentMethodId,
    paymentMethodNote,
    recipientPaymentMethodId,
    recipientPaymentMethodNote,
    categoryId,
    rentalId,
    roomBookingId,
    invoicingName,
    invoicingCuit,
  } = createMovementSchema.parse({
    description: formData.get("description"),
    amount: formData.get("amount"),
    currency: formData.get("currency") || undefined,
    paymentMethodId: formData.get("paymentMethodId"),
    paymentMethodNote: formData.get("paymentMethodNote") || undefined,
    recipientPaymentMethodId: formData.get("recipientPaymentMethodId") || undefined,
    recipientPaymentMethodNote: formData.get("recipientPaymentMethodNote") || undefined,
    categoryId: formData.get("categoryId") || undefined,
    rentalId: formData.get("rentalId") || undefined,
    roomBookingId: formData.get("roomBookingId") || undefined,
    invoicingName: formData.get("invoicingName") || undefined,
    invoicingCuit: formData.get("invoicingCuit") || undefined,
  });
  // El picker (`RentalPicker`) nunca manda los dos a la vez — solo uno de los
  // dos inputs ocultos lleva valor — pero se valida igual por si se llega a
  // mandar el form a mano.
  if (rentalId && roomBookingId) {
    throw new Error("Un movimiento no puede estar vinculado a un alquiler y a una habitación a la vez.");
  }
  // Garantía/depósito (se devuelve, no es un cobro/pago real) — ver
  // comentario de `isGuarantee` en el schema. Nunca editable después: si se
  // cargó mal, se borra y se carga de nuevo (mismo criterio que `type`).
  const isGuarantee = formData.get("isGuarantee") === "on";
  // Hay que facturar este ingreso (ver `needsInvoice` en el schema) — solo
  // tiene sentido en un Ingreso. Nombre/CUIT se tipean en el momento, nunca
  // editables después (mismo criterio que `isGuarantee`): si están mal, se
  // borra el movimiento y se carga de nuevo.
  const needsInvoice = type === "income" && formData.get("needsInvoice") === "on";
  if (needsInvoice && (!invoicingName || !invoicingCuit)) {
    throw new Error("Para facturar hace falta el Nombre/Razón Social y el CUIT.");
  }

  const method = await prisma.paymentMethod.findUnique({ where: { id: paymentMethodId } });
  if (!method) throw new Error("Medio de pago inválido");
  if (method.isBitcoin) throw new Error(BITCOIN_ACCOUNT_ERROR);
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

  // La categoría solo aplica a un Egreso — se ignora si llega en un Ingreso.
  let category: { id: string; name: string } | null = null;
  if (type === "expense" && categoryId) {
    category = await prisma.cashMovementCategory.findUnique({ where: { id: categoryId }, select: { id: true, name: true } });
    if (!category) throw new Error("Categoría inválida");
  }

  let roomBooking: { id: string; roomId: string } | null = null;
  if (roomBookingId) {
    roomBooking = await prisma.roomBooking.findUnique({ where: { id: roomBookingId }, select: { id: true, roomId: true } });
    if (!roomBooking) throw new Error("La reserva de habitación no existe.");
  }

  const createdId = await prisma.$transaction(async (tx) => {
    const created = await tx.cashMovement.create({
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
        categoryId: category?.id ?? null,
        categoryName: category?.name ?? null,
        rentalId: rentalId || null,
        roomBookingId: roomBooking?.id ?? null,
        isGuarantee,
        needsInvoice,
        invoicingName: needsInvoice ? invoicingName! : null,
        invoicingCuit: needsInvoice ? invoicingCuit! : null,
        createdById: user.id,
        createdByName: displayName(user),
      },
    });
    // Comisión automática del medio de pago (no aplica a garantías; cada
    // función resuelve sola si el medio tiene algo configurado). Atómica con
    // el movimiento. Cubre Movimientos +Ingreso/+Egreso, "+ Pago" a un
    // Proveedor y un egreso cargado a un Asociado — las tres pasan por acá.
    if (!isGuarantee) {
      if (type === "income") await syncCommission(tx, created.id, { id: user.id, name: displayName(user) });
      else await syncExpenseCommission(tx, created.id, { id: user.id, name: displayName(user) });
    }
    // Cuenta que factura sola (Mercado Pago, tarjetas, …) → va a Facturación.
    await syncAutoInvoice(tx, created.id);
    if (rentalId) await autoUnverifyRental(tx, rentalId, `Se cargó un movimiento de Caja (${description}).`);
    if (roomBooking) await autoUnverifyRoomBooking(tx, roomBooking.id, `Se cargó un movimiento de Caja (${description}).`);
    return created.id;
  });

  revalidatePath("/caja");
  revalidatePath("/caja/saldos/[id]", "page");
  if (roomBooking) {
    revalidatePath(`/rooms/${roomBooking.roomId}/bookings/${roomBooking.id}`);
    revalidatePath("/calendar");
  }

  // Se devuelve el movimiento recién creado (no el de la comisión, si generó
  // una) para que el formulario pueda confirmar el alta y mostrar su detalle
  // sin tener que re-listar — ver `CashMovementForm`.
  const row = await getCashMovementRow(createdId);
  if (!row) throw new Error("No se pudo recuperar el movimiento recién creado.");
  return row;
}

const updateMovementSchema = z.object({
  description: z.string().trim().min(1).max(500),
  amount: z.coerce.number().positive(),
  currency: z.enum(["ars", "usd"]).default("ars"),
  paymentMethodId: z.string().min(1),
  paymentMethodNote: z.string().trim().max(300).optional(),
  recipientPaymentMethodId: z.string().optional(),
  recipientPaymentMethodNote: z.string().trim().max(300).optional(),
  categoryId: z.string().optional(),
});

export type MovementChangeResult = { error?: string; pending?: boolean };

// Corrección de un error de carga (monto, medio de pago, detalle, y en un
// Egreso también Origen/Destino). Tipo y reserva vinculada no se editan — si
// están mal, se borra el movimiento y se carga de nuevo.
//
// Un admin (o finanzas/socio) edita directo y queda auditado en
// CashMovementEdit. Un empleado no: su cambio queda como pedido pendiente
// (`CashMovementChangeRequest`) y el movimiento no se toca hasta que un admin
// lo aprueba (ver `change-request-actions.ts`). Si no cambió nada, no se
// registra nada.
export async function updateCashMovement(id: string, formData: FormData): Promise<MovementChangeResult> {
  const user = await requireUser();
  const parsed = updateMovementSchema.safeParse({
    description: formData.get("description"),
    amount: formData.get("amount"),
    currency: formData.get("currency") || undefined,
    paymentMethodId: formData.get("paymentMethodId"),
    paymentMethodNote: formData.get("paymentMethodNote") || undefined,
    recipientPaymentMethodId: formData.get("recipientPaymentMethodId") || undefined,
    recipientPaymentMethodNote: formData.get("recipientPaymentMethodNote") || undefined,
    categoryId: formData.get("categoryId") || undefined,
  });
  if (!parsed.success) return { error: "Revisá los datos: falta el detalle, el monto o el medio de pago." };
  const input = parsed.data;

  const existing = await prisma.cashMovement.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) return { error: "El movimiento ya no existe." };

  try {
    const resolved = await resolveMovementEdit(existing, input);
    if (resolved.changes.length === 0) return {};

    if (!hasAdminAccess(user.role)) {
      const proposed = proposedMovementEdit(movementSnapshot(existing), input, existing.type as "income" | "expense");
      if (isEmptyProposal(proposed)) return {};
      await createChangeRequest(existing.id, { kind: "update", proposed, changes: resolved.changes }, user);
      revalidatePath("/caja");
      return { pending: true };
    }

    await prisma.$transaction((tx) =>
      applyMovementEdit(tx, existing, resolved, { id: user.id, name: displayName(user) }),
    );
  } catch (e) {
    if (e instanceof MovementEditError) return { error: e.message };
    throw e;
  }

  revalidatePath("/caja");
  return {};
}

// Borrado de un movimiento mal cargado: solo admin (o finanzas/socio). Soft
// delete: la fila queda (deletedAt/deletedById) para que el historial de
// ediciones pueda seguir mostrando qué era. El motivo (obligatorio) queda en
// `changes`. Un empleado pide la eliminación con `requestCashMovementDeletion`.
export async function deleteCashMovement(id: string, formData: FormData): Promise<MovementChangeResult> {
  const user = await requireUser();
  if (!hasAdminAccess(user.role)) {
    return { error: "Solo un administrador o Finanzas puede eliminar. Pedí la eliminación." };
  }
  const note = z.string().trim().min(1).max(300).safeParse(formData.get("note"));
  if (!note.success) return { error: "Escribí el motivo." };

  const existing = await prisma.cashMovement.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) return { error: "El movimiento ya no existe." };

  try {
    assertMovementDeletable(existing);
    await prisma.$transaction((tx) =>
      applyMovementDelete(tx, existing, note.data, { id: user.id, name: displayName(user) }),
    );
  } catch (e) {
    if (e instanceof MovementEditError) return { error: e.message };
    throw e;
  }

  revalidatePath("/caja");
  return {};
}

// Un empleado pide eliminar un movimiento (con motivo). No se borra nada
// hasta que un admin lo aprueba. Un admin no lo necesita: elimina directo.
export async function requestCashMovementDeletion(id: string, formData: FormData): Promise<MovementChangeResult> {
  const user = await requireUser();
  const note = z.string().trim().min(1).max(300).safeParse(formData.get("note"));
  if (!note.success) return { error: "Escribí el motivo." };

  const existing = await prisma.cashMovement.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) return { error: "El movimiento ya no existe." };

  try {
    assertMovementDeletable(existing);
  } catch (e) {
    if (e instanceof MovementEditError) return { error: e.message };
    throw e;
  }

  await createChangeRequest(existing.id, { kind: "delete", note: note.data }, user);
  revalidatePath("/caja");
  return { pending: true };
}

/**
 * Crea un pedido de cambio. Como mucho uno pendiente por movimiento: si ya
 * había otro (de quien sea), queda cancelado y lo reemplaza este.
 */
async function createChangeRequest(
  cashMovementId: string,
  req:
    | { kind: "update"; proposed: ProposedMovementEdit; changes: CashMovementFieldChange[] }
    | { kind: "delete"; note: string },
  user: { id: string; name?: string | null },
) {
  const name = displayName(user);
  await prisma.$transaction(async (tx) => {
    await tx.cashMovementChangeRequest.updateMany({
      where: { cashMovementId, status: "pending" },
      data: {
        status: "cancelled",
        resolvedAt: new Date(),
        resolvedById: user.id,
        resolvedByName: name,
        resolutionNote: "Lo reemplazó un pedido más nuevo.",
      },
    });
    await tx.cashMovementChangeRequest.create({
      data: {
        cashMovementId,
        kind: req.kind,
        proposed: req.kind === "update" ? req.proposed : undefined,
        changes: req.kind === "update" ? req.changes : undefined,
        note: req.kind === "delete" ? req.note : null,
        requestedById: user.id,
        requestedByName: name,
      },
    });
  });
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
  if (method.isBitcoin) throw new Error(BITCOIN_ACCOUNT_ERROR);
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
        editedByName: displayName(user),
      },
    });
    // Recién ahora se sabe el medio real: si tiene comisión, se genera, y si
    // la cuenta factura sola, va a Facturación.
    await syncCommission(tx, id, { id: user.id, name: displayName(user) });
    await syncAutoInvoice(tx, id);

    if (existing.rentalId) {
      await autoUnverifyRental(tx, existing.rentalId, "Se confirmó el medio de pago de un cobro de la reserva.");
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
        const nextPaid = paidTotal(nextPayments);
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
