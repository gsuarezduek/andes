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
  /** Otras cuentas reales de esta misma entidad (ver `PaymentMethod.parentId`)
   *  — para poder elegir por cuál salió un pago puntual (`ProviderPaymentForm`)
   *  sin perder esa info, aunque el saldo ya viene sumado entre todas. */
  subaccounts: { id: string; name: string }[];
};

/**
 * Mapa cuenta → cuenta principal del grupo (una cuenta principal se mapea a
 * sí misma). Varias cuentas reales de la misma entidad (`PaymentMethod.parentId`,
 * ej. un proveedor con efectivo y transferencia) se agrupan bajo su
 * principal para que los cálculos no queden partidos por cuenta — ver
 * comentario en el schema.
 */
async function resolveProvidersToPrincipal(): Promise<{
  principals: { id: string; name: string; subaccounts: { id: string; name: string }[] }[];
  resolve: Map<string, string>;
  memberIds: string[];
}> {
  const accounts = await prisma.paymentMethod.findMany({
    where: { ownership: "provider" },
    orderBy: { ordering: "asc" },
    select: { id: true, name: true, parentId: true, active: true },
  });
  const resolve = new Map<string, string>();
  for (const a of accounts) resolve.set(a.id, a.parentId ?? a.id);
  const principals = accounts
    .filter((a) => a.parentId === null && a.active)
    .map((p) => ({
      id: p.id,
      name: p.name,
      subaccounts: accounts.filter((a) => a.parentId === p.id).map((a) => ({ id: a.id, name: a.name })),
    }));
  return { principals, resolve, memberIds: accounts.map((a) => a.id) };
}

/**
 * Saldo de cuenta corriente de cada proveedor (`PaymentMethod.ownership =
 * "provider"`, solo cuentas principales — las subcuentas se suman ahí, no
 * aparecen sueltas), histórico completo — igual que el saldo de Caja fuerte,
 * es "cuánto se debe hoy", no un corte por período.
 *
 * balance = deudas acumuladas (`CashMovement.type = "debt"`, Destino =
 * proveedor) − lo que ya le llegó, sea porque el cliente le pagó directo
 * (Ingreso con ese proveedor como medio de pago) o porque la empresa le pagó
 * (Egreso con ese proveedor como Destino) — las dos formas saldan lo mismo.
 * Info sensible — solo para admin.
 */
export async function getProviderBalances(): Promise<ProviderBalance[]> {
  const { principals, resolve, memberIds } = await resolveProvidersToPrincipal();
  if (principals.length === 0) return [];

  const [debts, clientPayments, companyPayments] = await Promise.all([
    prisma.cashMovement.groupBy({
      by: ["recipientPaymentMethodId", "currency"],
      where: { type: "debt", deletedAt: null, recipientPaymentMethodId: { in: memberIds } },
      _sum: { amount: true },
    }),
    prisma.cashMovement.groupBy({
      by: ["paymentMethodId", "currency"],
      where: { type: "income", deletedAt: null, paymentMethodId: { in: memberIds } },
      _sum: { amount: true },
    }),
    prisma.cashMovement.groupBy({
      by: ["recipientPaymentMethodId", "currency"],
      where: { type: "expense", deletedAt: null, recipientPaymentMethodId: { in: memberIds } },
      _sum: { amount: true },
    }),
  ]);

  const balances = new Map(principals.map((p) => [p.id, emptyCurrencyTotals()]));
  for (const row of debts) {
    const principalId = row.recipientPaymentMethodId && resolve.get(row.recipientPaymentMethodId);
    const totals = principalId && balances.get(principalId);
    if (totals) totals[row.currency] += Number(row._sum.amount ?? 0);
  }
  for (const row of clientPayments) {
    const principalId = row.paymentMethodId && resolve.get(row.paymentMethodId);
    const totals = principalId && balances.get(principalId);
    if (totals) totals[row.currency] -= Number(row._sum.amount ?? 0);
  }
  for (const row of companyPayments) {
    const principalId = row.recipientPaymentMethodId && resolve.get(row.recipientPaymentMethodId);
    const totals = principalId && balances.get(principalId);
    if (totals) totals[row.currency] -= Number(row._sum.amount ?? 0);
  }

  return principals.map((p) => ({
    id: p.id,
    name: p.name,
    balance: balances.get(p.id)!,
    subaccounts: p.subaccounts,
  }));
}

export type ProviderLedgerRow = {
  id: string;
  // "debt" suma al saldo (le debemos más); los otros dos lo saldan.
  kind: "debt" | "client_payment" | "company_payment";
  description: string;
  amount: number;
  currency: Currency;
  // Nombre de la cuenta real usada (puede ser una subcuenta) — se muestra
  // solo cuando difiere de la principal, para no romper la vista unificada
  // pero sin perder de qué cuenta salió/entró la plata.
  accountName: string;
  createdByName: string;
  createdAt: Date;
};

/**
 * Historial completo de un proveedor — principal + todas sus subcuentas
 * (deudas + los dos tipos de pago que las saldan), más reciente primero. Es
 * lo que arma el saldo de arriba, fila por fila. Solo admin.
 */
export async function getProviderLedger(providerId: string): Promise<ProviderLedgerRow[]> {
  const members = await prisma.paymentMethod.findMany({
    where: { OR: [{ id: providerId }, { parentId: providerId }] },
    select: { id: true },
  });
  const memberIds = members.map((m) => m.id);

  const rows = await prisma.cashMovement.findMany({
    where: {
      deletedAt: null,
      OR: [
        { type: "debt", recipientPaymentMethodId: { in: memberIds } },
        { type: "income", paymentMethodId: { in: memberIds } },
        { type: "expense", recipientPaymentMethodId: { in: memberIds } },
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
    accountName: (r.type === "income" ? r.paymentMethodName : r.recipientPaymentMethodName) ?? "",
    createdByName: r.createdBy?.name ?? "—",
    createdAt: r.createdAt,
  }));
}
