import "server-only";
import { prisma } from "@/lib/prisma";
import type { Currency } from "@/lib/currency";

export type FundMovementRow = {
  id: string;
  type: "deposit" | "withdrawal";
  amount: number;
  currency: Currency;
  note: string | null;
  createdByName: string;
  createdAt: Date;
};

/**
 * Movimientos de fondos vigentes (sin eliminar) de una cuenta propia, más
 * reciente primero — para el bloque "Fondos de inversión" de
 * `/caja/saldos/[id]` (ver `PaymentMethod.hasInvestmentFunds`).
 */
export async function getFundMovements(paymentMethodId: string): Promise<FundMovementRow[]> {
  const rows = await prisma.fundMovement.findMany({
    where: { paymentMethodId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    amount: Number(r.amount),
    currency: r.currency,
    note: r.note,
    createdByName: r.createdByName,
    createdAt: r.createdAt,
  }));
}
