"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { hasAdminAccess } from "@/lib/user-permissions";
import { displayName } from "@/lib/user-display";
import {
  MovementEditError,
  applyMovementDelete,
  applyMovementEdit,
  assertMovementDeletable,
  movementSnapshot,
  resolveMovementEdit,
} from "@/lib/cash-movement-edit";
import { mergeProposedEdit, type ProposedMovementEdit } from "@/lib/cash-change-request";

export type ChangeRequestResult = { error?: string; notice?: string };

const ALREADY_RESOLVED = "Este pedido ya se resolvió.";

/**
 * Aprueba el pedido de un empleado (ver `CashMovementChangeRequest`): recién
 * ahí se aplica el cambio o se elimina el movimiento. En el historial queda
 * quien lo pidió como autor y quien lo aprobó aparte. Si algo ya no es válido
 * (ej. el ingreso se facturó mientras tanto), no se aplica nada y se avisa:
 * el admin puede rechazarlo.
 */
export async function approveChangeRequest(id: string): Promise<ChangeRequestResult> {
  const user = await requireUser();
  if (!hasAdminAccess(user.role)) return { error: "Solo un administrador o Finanzas puede aprobar." };
  const approver = { id: user.id, name: displayName(user) };

  const request = await prisma.cashMovementChangeRequest.findUnique({
    where: { id },
    include: { cashMovement: true },
  });
  if (!request || request.status !== "pending") return { error: ALREADY_RESOLVED };
  const movement = request.cashMovement;
  if (movement.deletedAt) return { error: "El movimiento ya se eliminó." };
  const editor = { id: request.requestedById, name: request.requestedByName };

  let notice: string | undefined;
  try {
    if (request.kind === "delete") {
      assertMovementDeletable(movement);
      await prisma.$transaction(async (tx) => {
        await claim(tx, id, approver);
        await applyMovementDelete(tx, movement, request.note ?? "—", editor, approver);
      });
    } else {
      const input = mergeProposedEdit(movementSnapshot(movement), (request.proposed ?? {}) as ProposedMovementEdit);
      const resolved = await resolveMovementEdit(movement, input);
      await prisma.$transaction(async (tx) => {
        await claim(tx, id, approver);
        // Puede no quedar nada por cambiar si un admin ya lo corrigió igual.
        if (resolved.changes.length > 0) await applyMovementEdit(tx, movement, resolved, editor, approver);
      });
      if (resolved.changes.length === 0) notice = "Aprobado: el movimiento ya tenía esos valores.";
    }
  } catch (e) {
    if (e instanceof MovementEditError) {
      return { error: e.message === ALREADY_RESOLVED ? e.message : `No se puede aplicar: ${e.message}` };
    }
    throw e;
  }

  revalidatePath("/caja");
  return { notice };
}

/** Rechaza el pedido, con motivo obligatorio (lo ve quien lo pidió). */
export async function rejectChangeRequest(id: string, formData: FormData): Promise<ChangeRequestResult> {
  const user = await requireUser();
  if (!hasAdminAccess(user.role)) return { error: "Solo un administrador o Finanzas puede rechazar." };
  const reason = z.string().trim().min(1).max(300).safeParse(formData.get("reason"));
  if (!reason.success) return { error: "Escribí el motivo del rechazo." };

  const { count } = await prisma.cashMovementChangeRequest.updateMany({
    where: { id, status: "pending" },
    data: {
      status: "rejected",
      resolvedAt: new Date(),
      resolvedById: user.id,
      resolvedByName: displayName(user),
      resolutionNote: reason.data,
    },
  });
  if (count === 0) return { error: ALREADY_RESOLVED };

  revalidatePath("/caja");
  return {};
}

/** Quien hizo el pedido lo retira mientras siga pendiente. */
export async function withdrawChangeRequest(id: string): Promise<ChangeRequestResult> {
  const user = await requireUser();
  const { count } = await prisma.cashMovementChangeRequest.updateMany({
    where: { id, status: "pending", requestedById: user.id },
    data: {
      status: "cancelled",
      resolvedAt: new Date(),
      resolvedById: user.id,
      resolvedByName: displayName(user),
      resolutionNote: "Lo retiró quien lo pidió.",
    },
  });
  if (count === 0) return { error: ALREADY_RESOLVED };

  revalidatePath("/caja");
  return {};
}

/**
 * Marca el pedido como aprobado dentro de la misma transacción que aplica el
 * cambio: si dos admins aprueban a la vez, el segundo no encuentra el pedido
 * pendiente y no se aplica dos veces.
 */
async function claim(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  id: string,
  approver: { id: string; name: string },
) {
  const { count } = await tx.cashMovementChangeRequest.updateMany({
    where: { id, status: "pending" },
    data: { status: "approved", resolvedAt: new Date(), resolvedById: approver.id, resolvedByName: approver.name },
  });
  if (count === 0) throw new MovementEditError(ALREADY_RESOLVED);
}
