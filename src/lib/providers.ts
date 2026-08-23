import "server-only";
import { prisma } from "@/lib/prisma";
import { emptyCurrencyTotals, type Currency, type CurrencyTotals } from "@/lib/currency";

export type ProviderBalance = {
  id: string;
  name: string;
  /**
   * Saldo de cuenta corriente. Positivo = le debemos (deudas acumuladas
   * todavía sin saldar); negativo = a favor nuestro (le llegó más de lo que
   * se le debía — ej. el cliente le pagó de más directo).
   */
  balance: CurrencyTotals;
};

/**
 * Saldo de cuenta corriente de cada proveedor (`PaymentMethod.thirdPartyKind
 * = "provider"`), histórico completo — igual que el saldo de Caja fuerte, es
 * "cuánto se debe hoy", no un corte por período.
 *
 * balance = deudas acumuladas (`CashMovement.type = "debt"`, Destino =
 * proveedor) − lo que ya le llegó, sea porque el cliente le pagó directo
 * (Ingreso con ese proveedor como medio de pago) o porque la empresa le pagó
 * (Egreso con ese proveedor como Destino) — las dos formas saldan lo mismo.
 * Info sensible — solo para admin.
 */
export async function getProviderBalances(): Promise<ProviderBalance[]> {
  const providers = await prisma.paymentMethod.findMany({
    where: { ownership: "third_party", thirdPartyKind: "provider", active: true },
    orderBy: { ordering: "asc" },
    select: { id: true, name: true },
  });
  if (providers.length === 0) return [];
  const providerIds = providers.map((p) => p.id);

  const [debts, clientPayments, companyPayments] = await Promise.all([
    prisma.cashMovement.groupBy({
      by: ["recipientPaymentMethodId", "currency"],
      where: { type: "debt", deletedAt: null, recipientPaymentMethodId: { in: providerIds } },
      _sum: { amount: true },
    }),
    prisma.cashMovement.groupBy({
      by: ["paymentMethodId", "currency"],
      where: { type: "income", deletedAt: null, paymentMethodId: { in: providerIds } },
      _sum: { amount: true },
    }),
    prisma.cashMovement.groupBy({
      by: ["recipientPaymentMethodId", "currency"],
      where: { type: "expense", deletedAt: null, recipientPaymentMethodId: { in: providerIds } },
      _sum: { amount: true },
    }),
  ]);

  return providers.map((p) => {
    const balance = emptyCurrencyTotals();
    for (const row of debts) {
      if (row.recipientPaymentMethodId === p.id) balance[row.currency] += Number(row._sum.amount ?? 0);
    }
    for (const row of clientPayments) {
      if (row.paymentMethodId === p.id) balance[row.currency] -= Number(row._sum.amount ?? 0);
    }
    for (const row of companyPayments) {
      if (row.recipientPaymentMethodId === p.id) balance[row.currency] -= Number(row._sum.amount ?? 0);
    }
    return { id: p.id, name: p.name, balance };
  });
}

export type ProviderLedgerRow = {
  id: string;
  // "debt" suma al saldo (le debemos más); los otros dos lo saldan.
  kind: "debt" | "client_payment" | "company_payment";
  description: string;
  amount: number;
  currency: Currency;
  createdByName: string;
  createdAt: Date;
};

/**
 * Historial completo de un proveedor (deudas + los dos tipos de pago que las
 * saldan), más reciente primero — es lo que arma el saldo de arriba, fila por
 * fila. Solo admin.
 */
export async function getProviderLedger(providerId: string): Promise<ProviderLedgerRow[]> {
  const rows = await prisma.cashMovement.findMany({
    where: {
      deletedAt: null,
      OR: [
        { type: "debt", recipientPaymentMethodId: providerId },
        { type: "income", paymentMethodId: providerId },
        { type: "expense", recipientPaymentMethodId: providerId },
      ],
    },
    include: { createdBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    kind: r.type === "debt" ? "debt" : r.type === "income" ? "client_payment" : "company_payment",
    description: r.description,
    amount: Number(r.amount),
    currency: r.currency,
    createdByName: r.createdBy?.name ?? "—",
    createdAt: r.createdAt,
  }));
}
