import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { FieldChange } from "@/lib/movement-audit";
import { emptyCurrencyTotals, type Currency, type CurrencyTotals } from "@/lib/currency";

const SAFE_MOVEMENTS_LIMIT = 100;

export type SafeMovementRow = {
  id: string;
  type: "deposit" | "withdrawal";
  description: string;
  amount: number;
  currency: Currency;
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
    currency: r.currency,
    createdByName: r.createdBy?.name ?? "—",
    createdAt: r.createdAt,
  }));
}

/**
 * Historial completo de movimientos de caja fuerte — solo admin (a
 * diferencia de Movimientos/Proveedores, acá ni siquiera se ve el propio: es
 * efectivo físico real, más sensible que el resto de Caja). Cualquier rol
 * puede seguir cargando un ingreso/retiro (`createSafeMovement`), solo que no
 * ve el historial ni el saldo.
 */
export async function getAllSafeMovements(): Promise<SafeMovementRow[]> {
  return findSafeMovements({});
}

/**
 * Saldo acumulado histórico (ingresos − retiros), de todo el historial, no
 * por mes: representa cuánto efectivo hay hoy en la caja fuerte física.
 * Separado por moneda — nunca sumado entre sí. Info sensible — solo para admin.
 */
export async function getSafeBalance(): Promise<CurrencyTotals> {
  const [deposits, withdrawals] = await Promise.all([
    prisma.safeMovement.groupBy({ by: ["currency"], where: { type: "deposit", deletedAt: null }, _sum: { amount: true } }),
    prisma.safeMovement.groupBy({ by: ["currency"], where: { type: "withdrawal", deletedAt: null }, _sum: { amount: true } }),
  ]);
  const totals = emptyCurrencyTotals();
  for (const row of deposits) totals[row.currency] += Number(row._sum.amount ?? 0);
  for (const row of withdrawals) totals[row.currency] -= Number(row._sum.amount ?? 0);
  return totals;
}

export type SafeMovementFieldChange = FieldChange;

export type SafeMovementEditRow = {
  id: string;
  action: "updated" | "deleted";
  changes: SafeMovementFieldChange[] | null;
  editedByName: string;
  movementDescription: string;
  movementAmount: number;
  movementCurrency: Currency;
  movementType: "deposit" | "withdrawal";
  createdAt: Date;
};

/** Historial de ediciones/borrados de movimientos de caja fuerte — solo admin. */
export async function getSafeMovementEdits(): Promise<SafeMovementEditRow[]> {
  const rows = await prisma.safeMovementEdit.findMany({
    include: {
      editedBy: { select: { name: true } },
      safeMovement: { select: { description: true, amount: true, currency: true, type: true } },
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
    movementCurrency: r.safeMovement.currency,
    movementType: r.safeMovement.type,
    createdAt: r.createdAt,
  }));
}
