import "server-only";
import type { PaymentMethodOwnership } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AUTO_IMPORT_CREATOR_LABEL } from "@/lib/cash";
import { emptyCurrencyTotals, type Currency, type CurrencyTotals } from "@/lib/currency";

/**
 * Cuenta corriente genérica para una cuenta ajena (proveedor o asociado) —
 * usada por `providers.ts` y `associates.ts`, que solo fijan `ownership`.
 * Mismo mecanismo para los dos: `debt` (alguien pagó/hizo algo que le
 * correspondía a la empresa, sin que se le devuelva en el momento) suma al
 * saldo; `income` (el cliente le pagó directo) y `expense` (la empresa le
 * pagó) lo saldan. Positivo = le debemos; negativo = a favor nuestro.
 */
export type ThirdPartyBalance = {
  id: string;
  name: string;
  balance: CurrencyTotals;
  /** Otras cuentas reales de esta misma entidad (ver `PaymentMethod.parentId`)
   *  — para poder elegir por cuál cargar un movimiento puntual sin perder esa
   *  info, aunque el saldo ya viene sumado entre todas. */
  subaccounts: { id: string; name: string }[];
};

/**
 * Mapa cuenta → cuenta principal del grupo (una cuenta principal se mapea a
 * sí misma). Varias cuentas reales de la misma entidad (`PaymentMethod.parentId`)
 * se agrupan bajo su principal para que los cálculos no queden partidos por
 * cuenta — ver comentario en el schema.
 */
async function resolveToPrincipal(ownership: PaymentMethodOwnership): Promise<{
  principals: { id: string; name: string; subaccounts: { id: string; name: string }[] }[];
  resolve: Map<string, string>;
  memberIds: string[];
}> {
  const accounts = await prisma.paymentMethod.findMany({
    where: { ownership },
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
 * Saldo de cuenta corriente de cada cuenta ajena de este `ownership`, solo
 * cuentas principales (las subcuentas se suman ahí), histórico completo — es
 * "cuánto se debe hoy", no un corte por período. Info operativa, visible para
 * cualquier rol.
 */
export async function getThirdPartyBalances(ownership: PaymentMethodOwnership): Promise<ThirdPartyBalance[]> {
  const { principals, resolve, memberIds } = await resolveToPrincipal(ownership);
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

export type ThirdPartyLedgerRow = {
  id: string;
  // "debt" suma al saldo (le debemos más); los otros dos lo saldan.
  kind: "debt" | "client_payment" | "company_payment";
  description: string;
  amount: number;
  currency: Currency;
  // Nombre de la cuenta real usada (puede ser una subcuenta) — se muestra
  // solo cuando difiere de la principal.
  accountName: string;
  createdByName: string;
  createdAt: Date;
};

/**
 * Historial completo de una cuenta ajena — principal + todas sus subcuentas
 * (deudas + los dos tipos de pago que las saldan), más reciente primero. Trae
 * TODO el histórico sin acotar por mes — la UI decide cuánto mostrar de
 * entrada (ver `filterThisMonth`/`groupProviderLedgerByMonth`).
 */
export async function getThirdPartyLedger(accountId: string): Promise<ThirdPartyLedgerRow[]> {
  const members = await prisma.paymentMethod.findMany({
    where: { OR: [{ id: accountId }, { parentId: accountId }] },
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
    createdByName: r.createdBy?.name ?? AUTO_IMPORT_CREATOR_LABEL,
    createdAt: r.createdAt,
  }));
}
