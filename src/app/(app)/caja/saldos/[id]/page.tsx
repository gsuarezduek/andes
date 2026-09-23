import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { ButtonLink } from "@/components/ui/button";
import { getOwnAccountBalances, getOwnAccountLedger } from "@/lib/cash";
import { groupProviderLedgerByMonth } from "@/lib/provider-ledger-grouping";
import { CurrencyTotalsDisplay } from "@/components/cash/currency-totals-display";
import { AccountLedgerMonths } from "@/components/cash/account-ledger-months";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const account = (await getOwnAccountBalances()).find((a) => a.id === id);
  return { title: account ? `${account.name} — Caja — Andes` : "Cuenta — Andes" };
}

/**
 * Historial completo de una cuenta propia (Saldos → "Ver movimientos"),
 * partido por mes — reemplaza el viejo expandible inline en la pestaña Caja
 * (ver `AccountCard`): pedido del dueño para no amontonar varias cuentas en
 * una sola pantalla larga. Admin-only, mismo criterio que la pestaña Saldos.
 */
export default async function AccountLedgerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const [accounts, ledger, paymentMethods, expenseCategories] = await Promise.all([
    getOwnAccountBalances(),
    getOwnAccountLedger(id),
    prisma.paymentMethod.findMany({
      where: { active: true },
      orderBy: { ordering: "asc" },
      select: { id: true, name: true, requiresNote: true, ownership: true },
    }),
    prisma.cashMovementCategory.findMany({
      where: { active: true },
      orderBy: { ordering: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const account = accounts.find((a) => a.id === id);
  if (!account) notFound();

  // `getOwnAccountLedger` ya viene ordenado por `createdAt` desc (ver
  // `findMovements`) — el agrupador solo junta consecutivos del mismo mes.
  const groups = groupProviderLedgerByMonth(ledger, new Date());

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{account.name}</h1>
          {account.subaccounts.length > 0 && (
            <p className="text-sm text-foreground/60">Incluye {account.subaccounts.map((s) => s.name).join(", ")}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <CurrencyTotalsDisplay totals={account.balance} size="text-xl" />
        </div>
      </div>

      <AccountLedgerMonths groups={groups} paymentMethods={paymentMethods} expenseCategories={expenseCategories} />

      <ButtonLink href="/caja" variant="secondary">
        Volver a Caja
      </ButtonLink>
    </div>
  );
}
