import "server-only";
import { prisma } from "@/lib/prisma";
import type { Currency } from "@/lib/currency";

export type AccountTransferRow = {
  id: string;
  /** `null` = Caja fuerte. */
  fromAccountId: string | null;
  fromAccountName: string;
  fromAmount: number;
  fromCurrency: Currency;
  /** `null` = Caja fuerte. */
  toAccountId: string | null;
  toAccountName: string;
  toAmount: number;
  toCurrency: Currency;
  description: string;
  createdByName: string;
  createdAt: Date;
};

/**
 * Traspasos vigentes (sin eliminar), más reciente primero. Con `accountId`,
 * solo los que involucran a esa cuenta principal o a cualquiera de sus
 * subcuentas. Con `safe`, solo los que entran o salen de la Caja fuerte.
 */
export async function getAccountTransfers(
  options: { accountId?: string; /** Solo los que tocan la Caja fuerte. */ safe?: boolean; limit?: number } = {},
): Promise<AccountTransferRow[]> {
  let accountIds: string[] | null = null;
  if (options.accountId) {
    const members = await prisma.paymentMethod.findMany({
      where: { OR: [{ id: options.accountId }, { parentId: options.accountId }] },
      select: { id: true },
    });
    accountIds = members.map((m) => m.id);
  }

  const rows = await prisma.accountTransfer.findMany({
    where: {
      deletedAt: null,
      ...(accountIds ? { OR: [{ fromAccountId: { in: accountIds } }, { toAccountId: { in: accountIds } }] } : {}),
      ...(options.safe ? { OR: [{ fromAccountId: null }, { toAccountId: null }] } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: options.limit ?? 50,
  });
  return rows.map((r) => ({
    id: r.id,
    fromAccountId: r.fromAccountId,
    fromAccountName: r.fromAccountName,
    fromAmount: Number(r.fromAmount),
    fromCurrency: r.fromCurrency,
    toAccountId: r.toAccountId,
    toAccountName: r.toAccountName,
    toAmount: Number(r.toAmount),
    toCurrency: r.toCurrency,
    description: r.description,
    createdByName: r.createdByName,
    createdAt: r.createdAt,
  }));
}
