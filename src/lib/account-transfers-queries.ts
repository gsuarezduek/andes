import "server-only";
import { prisma } from "@/lib/prisma";
import type { TransferCurrency } from "@/lib/currency";
import { RESTRICTED_ACCOUNT_NAME } from "@/lib/finance-only";

export type AccountTransferRow = {
  id: string;
  /** `null` = Caja fuerte. */
  fromAccountId: string | null;
  fromAccountName: string;
  fromAmount: number;
  fromCurrency: TransferCurrency;
  /** `null` = Caja fuerte. */
  toAccountId: string | null;
  toAccountName: string;
  toAmount: number;
  toCurrency: TransferCurrency;
  description: string;
  createdByName: string;
  createdAt: Date;
  /** Uno de los lados es una cuenta de Finanzas que quien mira no puede ver: se muestra como "Cuenta reservada" y no se puede eliminar. */
  masked: boolean;
};

/**
 * Traspasos vigentes (sin eliminar), más reciente primero. Con `accountId`,
 * solo los que involucran a esa cuenta principal o a cualquiera de sus
 * subcuentas. Con `safe`, solo los que entran o salen de la Caja fuerte.
 */
export async function getAccountTransfers(
  options: {
    accountId?: string;
    /** Solo los que tocan la Caja fuerte. */
    safe?: boolean;
    limit?: number;
    /**
     * Cuentas de Finanzas que quien mira no puede ver (ver
     * `PaymentMethod.financeOnly`): un traspaso entre dos de ellas no se
     * muestra; uno con un solo lado restringido sí (la plata movida cuenta
     * en la cuenta visible), con ese lado como "Cuenta reservada".
     */
    maskAccountIds?: string[];
  } = {},
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
      ...(options.maskAccountIds?.length
        ? { NOT: { fromAccountId: { in: options.maskAccountIds }, toAccountId: { in: options.maskAccountIds } } }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: options.limit ?? 50,
  });
  const masked = new Set(options.maskAccountIds ?? []);
  return rows.map((r) => {
    const fromMasked = r.fromAccountId !== null && masked.has(r.fromAccountId);
    const toMasked = r.toAccountId !== null && masked.has(r.toAccountId);
    return {
      id: r.id,
      fromAccountId: r.fromAccountId,
      fromAccountName: fromMasked ? RESTRICTED_ACCOUNT_NAME : r.fromAccountName,
      fromAmount: Number(r.fromAmount),
      fromCurrency: r.fromCurrency,
      toAccountId: r.toAccountId,
      toAccountName: toMasked ? RESTRICTED_ACCOUNT_NAME : r.toAccountName,
      toAmount: Number(r.toAmount),
      toCurrency: r.toCurrency,
      description: r.description,
      createdByName: r.createdByName,
      createdAt: r.createdAt,
      masked: fromMasked || toMasked,
    };
  });
}
