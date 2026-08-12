"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, requireAdmin } from "@/lib/auth-helpers";
import type { CashMovementFieldChange } from "@/lib/cash";
import { diffDescriptionAndAmount } from "@/lib/movement-audit";

const createMovementSchema = z.object({
  description: z.string().trim().min(1).max(500),
  amount: z.coerce.number().positive(),
  paymentMethodId: z.string().min(1),
  paymentMethodNote: z.string().trim().max(300).optional(),
  recipientPaymentMethodId: z.string().optional(),
  recipientPaymentMethodNote: z.string().trim().max(300).optional(),
  rentalId: z.string().optional(),
});

// Movimiento de Caja: cobro o pago. Cualquier rol puede cargarlo — la
// restricción de "solo agregar" para empleados es de UI (no ven el detalle),
// no de permisos de escritura. Editar/eliminar es solo para admin (ver abajo).
//
// En un Pago, `paymentMethodId` es el Origen (obligatorio, tiene que ser una
// cuenta propia) y `recipientPaymentMethodId` el Destino (opcional, tiene que
// ser una cuenta ajena si se manda). En un Cobro no hay esa distinción — el
// medio puede ser cualquiera, como hasta ahora.
export async function createCashMovement(type: "income" | "expense", formData: FormData) {
  const user = await requireUser();
  const {
    description,
    amount,
    paymentMethodId,
    paymentMethodNote,
    recipientPaymentMethodId,
    recipientPaymentMethodNote,
    rentalId,
  } = createMovementSchema.parse({
    description: formData.get("description"),
    amount: formData.get("amount"),
    paymentMethodId: formData.get("paymentMethodId"),
    paymentMethodNote: formData.get("paymentMethodNote") || undefined,
    recipientPaymentMethodId: formData.get("recipientPaymentMethodId") || undefined,
    recipientPaymentMethodNote: formData.get("recipientPaymentMethodNote") || undefined,
    rentalId: formData.get("rentalId") || undefined,
  });

  const method = await prisma.paymentMethod.findUnique({ where: { id: paymentMethodId } });
  if (!method) throw new Error("Medio de pago inválido");
  if (type === "expense" && method.ownership !== "own") {
    throw new Error("El origen de un pago tiene que ser una cuenta propia.");
  }
  if (method.requiresNote && !paymentMethodNote) {
    throw new Error("Este medio de pago requiere indicar a dónde fue.");
  }

  let recipient: { id: string; name: string; requiresNote: boolean } | null = null;
  if (type === "expense" && recipientPaymentMethodId) {
    const found = await prisma.paymentMethod.findUnique({ where: { id: recipientPaymentMethodId } });
    if (!found) throw new Error("Destino inválido");
    if (found.ownership !== "third_party") throw new Error("El destino de un pago tiene que ser una cuenta ajena.");
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
  paymentMethodId: z.string().min(1),
  paymentMethodNote: z.string().trim().max(300).optional(),
  recipientPaymentMethodId: z.string().optional(),
  recipientPaymentMethodNote: z.string().trim().max(300).optional(),
});

// Corrección de un error de carga (monto, medio de pago, detalle, y en un
// Pago también Origen/Destino). Solo admin. Tipo y reserva vinculada no se
// editan — si están mal, se borra el movimiento y se carga de nuevo. Cada
// cambio real queda auditado en CashMovementEdit; si no cambió nada, no se
// registra nada.
export async function updateCashMovement(id: string, formData: FormData) {
  const user = await requireAdmin();
  const {
    description,
    amount,
    paymentMethodId,
    paymentMethodNote,
    recipientPaymentMethodId,
    recipientPaymentMethodNote,
  } = updateMovementSchema.parse({
    description: formData.get("description"),
    amount: formData.get("amount"),
    paymentMethodId: formData.get("paymentMethodId"),
    paymentMethodNote: formData.get("paymentMethodNote") || undefined,
    recipientPaymentMethodId: formData.get("recipientPaymentMethodId") || undefined,
    recipientPaymentMethodNote: formData.get("recipientPaymentMethodNote") || undefined,
  });

  const existing = await prisma.cashMovement.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) throw new Error("Movimiento no encontrado");

  const method = await prisma.paymentMethod.findUnique({ where: { id: paymentMethodId } });
  if (!method) throw new Error("Medio de pago inválido");
  if (existing.type === "expense" && method.ownership !== "own") {
    throw new Error("El origen de un pago tiene que ser una cuenta propia.");
  }
  if (method.requiresNote && !paymentMethodNote) {
    throw new Error("Este medio de pago requiere indicar a dónde fue.");
  }
  const nextNote = method.requiresNote ? (paymentMethodNote ?? null) : null;

  let recipient: { id: string; name: string; requiresNote: boolean } | null = null;
  if (existing.type === "expense" && recipientPaymentMethodId) {
    const found = await prisma.paymentMethod.findUnique({ where: { id: recipientPaymentMethodId } });
    if (!found) throw new Error("Destino inválido");
    if (found.ownership !== "third_party") throw new Error("El destino de un pago tiene que ser una cuenta ajena.");
    if (found.requiresNote && !recipientPaymentMethodNote) {
      throw new Error("Este destino requiere indicar a dónde fue.");
    }
    recipient = found;
  }
  const nextRecipientNote = recipient?.requiresNote ? (recipientPaymentMethodNote ?? null) : null;

  const changes: CashMovementFieldChange[] = diffDescriptionAndAmount(existing, { description, amount }, "Detalle");
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
