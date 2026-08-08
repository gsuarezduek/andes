"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, requireAdmin } from "@/lib/auth-helpers";
import type { SafeMovementFieldChange } from "@/lib/safe";
import { diffDescriptionAndAmount } from "@/lib/movement-audit";

const createSafeMovementSchema = z.object({
  description: z.string().trim().min(1).max(500),
  amount: z.coerce.number().positive(),
});

// Ingreso o retiro de efectivo de la caja fuerte. Cualquier rol puede
// cargarlo — igual que Cobro/Pago, la restricción de ver el detalle completo
// (y acá además el saldo) es de UI, no de permiso de escritura.
export async function createSafeMovement(type: "deposit" | "withdrawal", formData: FormData) {
  const user = await requireUser();
  const { description, amount } = createSafeMovementSchema.parse({
    description: formData.get("description"),
    amount: formData.get("amount"),
  });

  await prisma.safeMovement.create({
    data: { type, description, amount, createdById: user.id },
  });

  revalidatePath("/caja");
}

const updateSafeMovementSchema = z.object({
  description: z.string().trim().min(1).max(500),
  amount: z.coerce.number().positive(),
});

// Corrección de un error de carga (motivo, monto). Solo admin. El tipo
// (ingreso/retiro) no se edita — si está mal, se borra y se carga de nuevo
// (mismo criterio que CashMovement). Cada cambio real queda auditado en
// SafeMovementEdit; si no cambió nada, no se registra nada.
export async function updateSafeMovement(id: string, formData: FormData) {
  const user = await requireAdmin();
  const { description, amount } = updateSafeMovementSchema.parse({
    description: formData.get("description"),
    amount: formData.get("amount"),
  });

  const existing = await prisma.safeMovement.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) throw new Error("Movimiento no encontrado");

  const changes: SafeMovementFieldChange[] = diffDescriptionAndAmount(existing, { description, amount }, "Motivo");
  if (changes.length === 0) return;

  await prisma.$transaction([
    prisma.safeMovement.update({ where: { id }, data: { description, amount } }),
    prisma.safeMovementEdit.create({
      data: { safeMovementId: id, action: "updated", changes, editedById: user.id },
    }),
  ]);

  revalidatePath("/caja");
}

// Borrado de un movimiento mal cargado. Solo admin. Soft delete: la fila
// queda (deletedAt/deletedById) para que el historial de ediciones pueda
// seguir mostrando qué era, y no se descuadra el saldo por error.
export async function deleteSafeMovement(id: string) {
  const user = await requireAdmin();
  const existing = await prisma.safeMovement.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) throw new Error("Movimiento no encontrado");

  await prisma.$transaction([
    prisma.safeMovement.update({ where: { id }, data: { deletedAt: new Date(), deletedById: user.id } }),
    prisma.safeMovementEdit.create({
      data: { safeMovementId: id, action: "deleted", editedById: user.id },
    }),
  ]);

  revalidatePath("/caja");
}
