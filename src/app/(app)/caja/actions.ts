"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, requireAdmin } from "@/lib/auth-helpers";
import { formatArs } from "@/lib/contract";
import type { CashMovementFieldChange } from "@/lib/cash";

const createMovementSchema = z.object({
  description: z.string().trim().min(1).max(500),
  amount: z.coerce.number().positive(),
  paymentMethodId: z.string().min(1),
  paymentMethodNote: z.string().trim().max(300).optional(),
  rentalId: z.string().optional(),
});

// Movimiento de Caja: cobro o pago. Cualquier rol puede cargarlo — la
// restricción de "solo agregar" para empleados es de UI (no ven el detalle),
// no de permisos de escritura. Editar/eliminar es solo para admin (ver abajo).
export async function createCashMovement(type: "income" | "expense", formData: FormData) {
  const user = await requireUser();
  const { description, amount, paymentMethodId, paymentMethodNote, rentalId } = createMovementSchema.parse({
    description: formData.get("description"),
    amount: formData.get("amount"),
    paymentMethodId: formData.get("paymentMethodId"),
    paymentMethodNote: formData.get("paymentMethodNote") || undefined,
    rentalId: formData.get("rentalId") || undefined,
  });

  const method = await prisma.paymentMethod.findUnique({ where: { id: paymentMethodId } });
  if (!method) throw new Error("Medio de pago inválido");
  if (method.requiresNote && !paymentMethodNote) {
    throw new Error("Este medio de pago requiere indicar a dónde fue.");
  }

  await prisma.cashMovement.create({
    data: {
      type,
      description,
      amount,
      paymentMethodId: method.id,
      paymentMethodName: method.name,
      paymentMethodNote: method.requiresNote ? paymentMethodNote : null,
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
});

// Corrección de un error de carga (monto, medio de pago, detalle). Solo
// admin. Tipo y reserva vinculada no se editan — si están mal, se borra el
// movimiento y se carga de nuevo. Cada cambio real queda auditado en
// CashMovementEdit; si no cambió nada, no se registra nada.
export async function updateCashMovement(id: string, formData: FormData) {
  const user = await requireAdmin();
  const { description, amount, paymentMethodId, paymentMethodNote } = updateMovementSchema.parse({
    description: formData.get("description"),
    amount: formData.get("amount"),
    paymentMethodId: formData.get("paymentMethodId"),
    paymentMethodNote: formData.get("paymentMethodNote") || undefined,
  });

  const existing = await prisma.cashMovement.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) throw new Error("Movimiento no encontrado");

  const method = await prisma.paymentMethod.findUnique({ where: { id: paymentMethodId } });
  if (!method) throw new Error("Medio de pago inválido");
  if (method.requiresNote && !paymentMethodNote) {
    throw new Error("Este medio de pago requiere indicar a dónde fue.");
  }
  const nextNote = method.requiresNote ? (paymentMethodNote ?? null) : null;

  const changes: CashMovementFieldChange[] = [];
  if (existing.description !== description) {
    changes.push({ field: "Detalle", from: existing.description, to: description });
  }
  if (Number(existing.amount) !== amount) {
    changes.push({ field: "Monto", from: formatArs(Number(existing.amount)), to: formatArs(amount) });
  }
  if (existing.paymentMethodName !== method.name) {
    changes.push({ field: "Medio de pago", from: existing.paymentMethodName, to: method.name });
  }
  if ((existing.paymentMethodNote ?? "") !== (nextNote ?? "")) {
    changes.push({ field: "Aclaración", from: existing.paymentMethodNote ?? "—", to: nextNote ?? "—" });
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
// seguir mostrando qué era.
export async function deleteCashMovement(id: string) {
  const user = await requireAdmin();
  const existing = await prisma.cashMovement.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) throw new Error("Movimiento no encontrado");

  await prisma.$transaction([
    prisma.cashMovement.update({
      where: { id },
      data: { deletedAt: new Date(), deletedById: user.id },
    }),
    prisma.cashMovementEdit.create({
      data: { cashMovementId: id, action: "deleted", editedById: user.id },
    }),
  ]);

  revalidatePath("/caja");
}
