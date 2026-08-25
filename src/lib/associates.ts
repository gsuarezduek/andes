import "server-only";
import { prisma } from "@/lib/prisma";
import { emptyCurrencyTotals, type Currency, type CurrencyTotals } from "@/lib/currency";

export type AssociateBalance = {
  id: string;
  name: string;
  income: CurrencyTotals;
  expense: CurrencyTotals;
  /** Ingreso + Egreso combinados — cuánto le llegó en total a esta entidad,
   *  sea porque el cliente le pagó directo o porque la empresa le pagó (mismo
   *  criterio que "Total entregado" del filtro Cuenta en Movimientos). */
  delivered: CurrencyTotals;
  /** Otras cuentas reales de esta misma entidad (ver `PaymentMethod.parentId`)
   *  — para poder elegir por cuál cargar un ingreso/egreso puntual sin perder
   *  esa info, aunque el total ya viene sumado entre todas. */
  subaccounts: { id: string; name: string }[];
};

/**
 * Mapa cuenta → cuenta principal del grupo (mismo patrón que
 * `resolveProvidersToPrincipal` en `providers.ts` — ver comentario ahí).
 */
async function resolveAssociatesToPrincipal(): Promise<{
  principals: { id: string; name: string; subaccounts: { id: string; name: string }[] }[];
  resolve: Map<string, string>;
  memberIds: string[];
}> {
  const accounts = await prisma.paymentMethod.findMany({
    where: { ownership: "associate" },
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
 * Totales por asociado (`PaymentMethod.ownership = "associate"`, solo
 * cuentas principales — las subcuentas se suman ahí), histórico completo. A
 * diferencia de un proveedor, un asociado no tiene cuenta corriente (deuda) —
 * es sólo la foto de cuánto entró/salió por su cuenta. Visible para
 * cualquier rol (no es info sensible, es operativo).
 */
export async function getAssociateBalances(): Promise<AssociateBalance[]> {
  const { principals, resolve, memberIds } = await resolveAssociatesToPrincipal();
  if (principals.length === 0) return [];

  const [incomes, expenses] = await Promise.all([
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

  const incomeTotals = new Map(principals.map((p) => [p.id, emptyCurrencyTotals()]));
  const expenseTotals = new Map(principals.map((p) => [p.id, emptyCurrencyTotals()]));
  for (const row of incomes) {
    const principalId = row.paymentMethodId && resolve.get(row.paymentMethodId);
    const totals = principalId && incomeTotals.get(principalId);
    if (totals) totals[row.currency] += Number(row._sum.amount ?? 0);
  }
  for (const row of expenses) {
    const principalId = row.recipientPaymentMethodId && resolve.get(row.recipientPaymentMethodId);
    const totals = principalId && expenseTotals.get(principalId);
    if (totals) totals[row.currency] += Number(row._sum.amount ?? 0);
  }

  return principals.map((p) => {
    const income = incomeTotals.get(p.id)!;
    const expense = expenseTotals.get(p.id)!;
    return {
      id: p.id,
      name: p.name,
      income,
      expense,
      delivered: { ars: income.ars + expense.ars, usd: income.usd + expense.usd },
      subaccounts: p.subaccounts,
    };
  });
}

export type AssociateLedgerRow = {
  id: string;
  kind: "income" | "expense";
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
 * Historial completo de un asociado — principal + todas sus subcuentas, más
 * reciente primero. Visible para cualquier rol.
 */
export async function getAssociateLedger(associateId: string): Promise<AssociateLedgerRow[]> {
  const members = await prisma.paymentMethod.findMany({
    where: { OR: [{ id: associateId }, { parentId: associateId }] },
    select: { id: true },
  });
  const memberIds = members.map((m) => m.id);

  const rows = await prisma.cashMovement.findMany({
    where: {
      deletedAt: null,
      OR: [
        { type: "income", paymentMethodId: { in: memberIds } },
        { type: "expense", recipientPaymentMethodId: { in: memberIds } },
      ],
    },
    include: { createdBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    kind: r.type as "income" | "expense",
    description: r.description,
    amount: Number(r.amount),
    currency: r.currency,
    accountName: (r.type === "income" ? r.paymentMethodName : r.recipientPaymentMethodName) ?? "",
    createdByName: r.createdBy?.name ?? "—",
    createdAt: r.createdAt,
  }));
}
