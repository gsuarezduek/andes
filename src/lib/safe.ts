import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { FieldChange } from "@/lib/movement-audit";
import { emptyCurrencyTotals, type Currency, type CurrencyTotals } from "@/lib/currency";
import { safeDeltaFromTransfers } from "@/lib/account-transfers";

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
    orderBy: { createdAt: "desc" },
    take: SAFE_MOVEMENTS_LIMIT,
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    description: r.description,
    amount: Number(r.amount),
    currency: r.currency,
    createdByName: r.createdByName ?? "—",
    createdAt: r.createdAt,
  }));
}

/**
 * Historial completo de movimientos de caja fuerte — solo admin (a
 * diferencia de Movimientos/Proveedores, acá ni siquiera se ve el propio: es
 * efectivo físico real, más sensible que el resto de Caja). Ningún rol que no sea admin
 * ve el saldo ni el historial: la pestaña entera es admin-only. Los movimientos
 * nuevos se cargan como traspasos ("Mover entre cuentas"), no acá.
 */
export async function getAllSafeMovements(): Promise<SafeMovementRow[]> {
  return findSafeMovements({});
}

/**
 * Saldo de los movimientos VIEJOS de la caja fuerte (`SafeMovement`, ingreso −
 * retiro): los cargados antes de que la caja fuerte pasara a ser un extremo
 * más de los traspasos entre cuentas ("Mover entre cuentas"). Se conservan
 * tal cual. Separado por moneda.
 */
export async function getLegacySafeBalance(): Promise<CurrencyTotals> {
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
      safeMovement: { select: { description: true, amount: true, currency: true, type: true } },
    },
    orderBy: { createdAt: "desc" },
    take: SAFE_MOVEMENTS_LIMIT,
  });
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    changes: (r.changes as SafeMovementFieldChange[] | null) ?? null,
    editedByName: r.editedByName ?? "—",
    movementDescription: r.safeMovement.description,
    movementAmount: Number(r.safeMovement.amount),
    movementCurrency: r.safeMovement.currency,
    movementType: r.safeMovement.type,
    createdAt: r.createdAt,
  }));
}

/**
 * Saldo actual de la caja fuerte: movimientos viejos (`SafeMovement`) más los
 * traspasos que entran o salen de ella. Histórico completo, no por mes:
 * representa cuánto efectivo hay hoy en la caja fuerte física. Separado por
 * moneda — nunca sumado entre sí. Info sensible — solo para admin.
 */
export async function getSafeBalance(): Promise<CurrencyTotals> {
  const [legacy, transfers] = await Promise.all([
    getLegacySafeBalance(),
    prisma.accountTransfer.findMany({
      where: { deletedAt: null, OR: [{ fromAccountId: null }, { toAccountId: null }] },
    }),
  ]);
  const delta = safeDeltaFromTransfers(
    transfers.map((t) => ({
      fromAccountId: t.fromAccountId,
      fromAmount: Number(t.fromAmount),
      fromCurrency: t.fromCurrency,
      toAccountId: t.toAccountId,
      toAmount: Number(t.toAmount),
      toCurrency: t.toCurrency,
    })),
  );
  return { ars: legacy.ars + delta.ars, usd: legacy.usd + delta.usd };
}
