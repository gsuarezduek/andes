import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { FieldChange } from "@/lib/movement-audit";

const SAFE_MOVEMENTS_LIMIT = 100;

export type SafeMovementRow = {
  id: string;
  type: "deposit" | "withdrawal";
  description: string;
  amount: number;
  createdByName: string;
  createdAt: Date;
};

async function findSafeMovements(where: Prisma.SafeMovementWhereInput): Promise<SafeMovementRow[]> {
  const rows = await prisma.safeMovement.findMany({
    where: { ...where, deletedAt: null },
    include: { createdBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: SAFE_MOVEMENTS_LIMIT,
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    description: r.description,
    amount: Number(r.amount),
    createdByName: r.createdBy?.name ?? "—",
    createdAt: r.createdAt,
  }));
}

/** Historial completo de movimientos de caja fuerte (todos los usuarios) — solo admin. */
export async function getAllSafeMovements(): Promise<SafeMovementRow[]> {
  return findSafeMovements({});
}

/** Historial propio de movimientos de caja fuerte — cualquier rol ve el suyo. */
export async function getOwnSafeMovements(userId: string): Promise<SafeMovementRow[]> {
  return findSafeMovements({ createdById: userId });
}

/**
 * Saldo acumulado histórico (ingresos − retiros), de todo el historial, no
 * por mes: representa cuánto efectivo hay hoy en la caja fuerte física. Info
 * sensible — solo para admin.
 */
export async function getSafeBalance(): Promise<number> {
  const [deposits, withdrawals] = await Promise.all([
    prisma.safeMovement.aggregate({ where: { type: "deposit", deletedAt: null }, _sum: { amount: true } }),
    prisma.safeMovement.aggregate({ where: { type: "withdrawal", deletedAt: null }, _sum: { amount: true } }),
  ]);
  return Number(deposits._sum.amount ?? 0) - Number(withdrawals._sum.amount ?? 0);
}

export type SafeMovementFieldChange = FieldChange;

export type SafeMovementEditRow = {
  id: string;
  action: "updated" | "deleted";
  changes: SafeMovementFieldChange[] | null;
  editedByName: string;
  movementDescription: string;
  movementAmount: number;
  movementType: "deposit" | "withdrawal";
  createdAt: Date;
};

/** Historial de ediciones/borrados de movimientos de caja fuerte — solo admin. */
export async function getSafeMovementEdits(): Promise<SafeMovementEditRow[]> {
  const rows = await prisma.safeMovementEdit.findMany({
    include: {
      editedBy: { select: { name: true } },
      safeMovement: { select: { description: true, amount: true, type: true } },
    },
    orderBy: { createdAt: "desc" },
    take: SAFE_MOVEMENTS_LIMIT,
  });
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    changes: (r.changes as SafeMovementFieldChange[] | null) ?? null,
    editedByName: r.editedBy?.name ?? "—",
    movementDescription: r.safeMovement.description,
    movementAmount: Number(r.safeMovement.amount),
    movementType: r.safeMovement.type,
    createdAt: r.createdAt,
  }));
}
