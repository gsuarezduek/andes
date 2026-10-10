import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { ButtonLink } from "@/components/ui/button";
import { getOwnAccountBalances, getOwnAccountLedger, getOwnAccountBalanceHistory } from "@/lib/cash";
import { formatDateInput } from "@/lib/datetime";
import { groupProviderLedgerByMonth } from "@/lib/provider-ledger-grouping";
import { CurrencyTotalsDisplay } from "@/components/cash/currency-totals-display";
import { formatMoney } from "@/lib/contract";
import { CURRENCIES, subtractCurrencyTotals } from "@/lib/currency";
import { SectionTitle } from "@/components/ui/section-title";
import { TransferList } from "@/components/cash/transfer-list";
import { getAccountTransfers } from "@/lib/account-transfers-queries";
import { AccountLedgerMonths } from "@/components/cash/account-ledger-months";
import { CajaSectionNav } from "@/components/cash/caja-section-nav";
import { FundsSection } from "@/components/cash/funds-section";
import { getFundMovements } from "@/lib/investment-funds-queries";
import { fundBalance } from "@/lib/investment-funds";
import { BalanceHistoryChart } from "@/components/cash/balance-history-chart";
import {
  BALANCE_HISTORY_PERIOD_OPTIONS,
  parseBalanceHistoryPeriod,
  parseBalanceHistoryGranularity,
  resolveBalanceHistoryGranularity,
} from "@/lib/balance-history";

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
export default async function AccountLedgerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string; granularity?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { period: rawPeriod, granularity: rawGranularity } = await searchParams;
  const period = parseBalanceHistoryPeriod(rawPeriod);
  const granularity = resolveBalanceHistoryGranularity(period, parseBalanceHistoryGranularity(rawGranularity));

  const [accounts, ledger, transfers, paymentMethods, expenseCategories, pm, balanceHistory] = await Promise.all([
    getOwnAccountBalances(),
    getOwnAccountLedger(id),
    getAccountTransfers({ accountId: id, limit: 100 }),
    prisma.paymentMethod.findMany({
      where: { active: true },
      orderBy: { ordering: "asc" },
      select: { id: true, name: true, requiresNote: true, ownership: true, parentId: true },
    }),
    prisma.cashMovementCategory.findMany({
      where: { active: true },
      orderBy: { ordering: "asc" },
      select: { id: true, name: true },
    }),
    prisma.paymentMethod.findUnique({ where: { id }, select: { hasInvestmentFunds: true } }),
    getOwnAccountBalanceHistory(id, period, granularity),
  ]);

  const account = accounts.find((a) => a.id === id);
  if (!account) notFound();

  const fundMovements = pm?.hasInvestmentFunds ? await getFundMovements(id) : null;
  const liquidBalance = account.investedBalance
    ? subtractCurrencyTotals(account.balance, account.investedBalance)
    : null;
  const hasGuaranteeBalance = account.guaranteeBalance.ars !== 0 || account.guaranteeBalance.usd !== 0;

  // `getOwnAccountLedger` ya viene ordenado por `createdAt` desc (ver
  // `findMovements`) — el agrupador solo junta consecutivos del mismo mes.
  const perspectiveAccountIds = [account.id, ...account.subaccounts.map((s) => s.id)];
  const groups = groupProviderLedgerByMonth(ledger, new Date());

  return (
    <div className="flex flex-col gap-6">
      <CajaSectionNav active="saldos" />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{account.name}</h1>
          {account.subaccounts.length > 0 && (
            <p className="text-sm text-foreground/60">Incluye {account.subaccounts.map((s) => s.name).join(", ")}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <CurrencyTotalsDisplay totals={account.balance} size="text-xl" />
          {liquidBalance && (
            <p className="mt-0.5 text-xs text-foreground/50">
              En cuenta:{" "}
              {CURRENCIES.filter((c) => c === "ars" || liquidBalance[c] !== 0)
                .map((c) => formatMoney(liquidBalance[c], c))
                .join(" · ")}
            </p>
          )}
          {hasGuaranteeBalance && (
            <p className="mt-0.5 text-xs font-medium text-red-600 dark:text-red-400">
              En garantías:{" "}
              {CURRENCIES.filter((c) => c === "ars" || account.guaranteeBalance[c] !== 0)
                .map((c) => formatMoney(account.guaranteeBalance[c], c))
                .join(" · ")}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle>Evolución del saldo</SectionTitle>
          <form className="flex items-center gap-2">
            <select
              name="period"
              defaultValue={period}
              className="h-9 rounded-lg border border-foreground/15 bg-transparent px-2 text-sm outline-none focus:border-foreground/40"
            >
              {BALANCE_HISTORY_PERIOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              name="granularity"
              defaultValue={granularity}
              disabled={period === "12m"}
              className="h-9 rounded-lg border border-foreground/15 bg-transparent px-2 text-sm outline-none focus:border-foreground/40 disabled:opacity-50"
            >
              <option value="daily">Diario</option>
              <option value="weekly">Semanal</option>
            </select>
            <button className="h-9 rounded-lg border border-foreground/15 px-3 text-sm font-medium">Aplicar</button>
          </form>
        </div>
        {period === "12m" && (
          <p className="text-xs text-foreground/50">En el último año se muestra siempre semanal (diario sería demasiado ruido).</p>
        )}
        <BalanceHistoryChart points={balanceHistory} granularity={granularity} />
      </div>

      {fundMovements && (
        <FundsSection paymentMethodId={id} balance={fundBalance(fundMovements)} movements={fundMovements} />
      )}

      <AccountLedgerMonths
        groups={groups}
        currentMonthKey={formatDateInput(new Date()).slice(0, 7)}
        paymentMethods={paymentMethods}
        expenseCategories={expenseCategories}
        fundMovements={fundMovements}
      />

      <div className="flex flex-col gap-2">
        <SectionTitle>Traspasos</SectionTitle>
        <TransferList
          transfers={transfers}
          perspectiveAccountIds={perspectiveAccountIds}
          emptyText="Esta cuenta no tiene traspasos."
        />
      </div>

      <ButtonLink href="/caja" variant="secondary">
        Volver a Caja
      </ButtonLink>
    </div>
  );
}
