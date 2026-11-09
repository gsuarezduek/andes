import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin, getSessionUser } from "@/lib/auth-helpers";
import { hasFinanceAccess } from "@/lib/user-permissions";
import { prisma } from "@/lib/prisma";
import { ButtonLink } from "@/components/ui/button";
import {
  getBitcoinAccountBalances,
  getOwnAccountBalances,
  getOwnAccountLedger,
  getOwnAccountBalanceHistory,
  getRentalPickerOptions,
  getRoomBookingPickerOptions,
} from "@/lib/cash";
import { getSafeBalance } from "@/lib/safe";
import { getCurrentUsdRate } from "@/lib/usd-rate-queries";
import { getBtcPrice } from "@/lib/btc-price";
import { TransferLauncher } from "@/components/cash/transfer-launcher";
import { netContributedText } from "@/components/cash/bitcoin-account-card";
import { buildTransferOptions } from "@/lib/account-transfers";
import { financeOnlyAccountIds } from "@/lib/finance-only";
import { AccountQuickActions } from "@/components/cash/account-quick-actions";
import { FinanceOnlyBadge } from "@/components/cash/finance-only-badge";
import { formatDateInput } from "@/lib/datetime";
import { groupProviderLedgerByMonth } from "@/lib/provider-ledger-grouping";
import { CurrencyTotalsDisplay } from "@/components/cash/currency-totals-display";
import { formatBtc, formatMoney } from "@/lib/contract";
import { CURRENCIES, subtractCurrencyTotals } from "@/lib/currency";
import { SectionTitle } from "@/components/ui/section-title";
import { TransferList } from "@/components/cash/transfer-list";
import { getAccountTransfers } from "@/lib/account-transfers-queries";
import { AccountLedgerMonths } from "@/components/cash/account-ledger-months";
import { buildAccountLedgerEntries } from "@/lib/account-ledger";
import { CajaSectionNav } from "@/components/cash/caja-section-nav";
import { FundsSection } from "@/components/cash/funds-section";
import { getFundMovements } from "@/lib/investment-funds-queries";
import { fundBalance } from "@/lib/investment-funds";
import { BalanceHistoryChart } from "@/components/cash/balance-history-chart";
import {
  BALANCE_HISTORY_PERIOD_OPTIONS,
  type BalanceHistoryGranularity,
  type BalanceHistoryPeriod,
  type BalancePoint,
  parseBalanceHistoryPeriod,
  parseBalanceHistoryGranularity,
  resolveBalanceHistoryGranularity,
} from "@/lib/balance-history";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const sessionUser = await getSessionUser();
  const canSeeFinanceOnly = sessionUser ? hasFinanceAccess(sessionUser.role, sessionUser.owner) : false;
  const account =
    (await getOwnAccountBalances(canSeeFinanceOnly)).find((a) => a.id === id) ??
    (await getBitcoinAccountBalances(canSeeFinanceOnly)).find((a) => a.id === id);
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
  const user = await requireAdmin();
  const canSeeFinanceOnly = hasFinanceAccess(user.role, user.owner);
  const { id } = await params;
  const { period: rawPeriod, granularity: rawGranularity } = await searchParams;
  const period = parseBalanceHistoryPeriod(rawPeriod);
  const granularity = resolveBalanceHistoryGranularity(period, parseBalanceHistoryGranularity(rawGranularity));

  // Una cuenta Bitcoin tiene su propia vista: saldo y gráfico en BTC y
  // traspasos, sin ingresos/egresos.
  const kind = await prisma.paymentMethod.findUnique({ where: { id }, select: { isBitcoin: true } });
  if (kind?.isBitcoin) {
    return <BitcoinAccountView id={id} canSeeFinanceOnly={canSeeFinanceOnly} period={period} granularity={granularity} />;
  }

  const [
    accounts,
    ledger,
    transfers,
    paymentMethods,
    expenseCategories,
    pm,
    balanceHistory,
    rentalOptions,
    roomBookingOptions,
    safeBalance,
    usdRate,
    bitcoinAccounts,
  ] = await Promise.all([
    getOwnAccountBalances(canSeeFinanceOnly),
    getOwnAccountLedger(id),
    financeOnlyAccountIds(canSeeFinanceOnly).then((ids) =>
      // Todos: van mezclados en el historial mensual, que no tiene tope.
      getAccountTransfers({ accountId: id, limit: null, maskAccountIds: ids }),
    ),
    prisma.paymentMethod.findMany({
      // Una cuenta Bitcoin no recibe ingresos ni egresos (solo traspasos en BTC).
      where: { active: true, isBitcoin: false, ...(canSeeFinanceOnly ? {} : { financeOnly: false }) },
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
    getRentalPickerOptions(),
    getRoomBookingPickerOptions(),
    getSafeBalance(),
    getCurrentUsdRate(),
    getBitcoinAccountBalances(canSeeFinanceOnly),
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
  // Ingresos/egresos y traspasos juntos, por fecha (ver `AccountLedgerMonths`).
  const groups = groupProviderLedgerByMonth(
    buildAccountLedgerEntries(ledger, transfers, perspectiveAccountIds),
    new Date(),
  );
  const transferOptions = buildTransferOptions(accounts, safeBalance, bitcoinAccounts);
  const btcPrice = bitcoinAccounts.length > 0 ? await getBtcPrice() : null;

  return (
    <div className="flex flex-col gap-6">
      <CajaSectionNav active="saldos" />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{account.name}</h1>
            {account.financeOnly && <FinanceOnlyBadge />}
          </div>
          {account.financeOnly && (
            <p className="text-sm text-foreground/60">Solo la ven Finanzas, Socio y el propietario.</p>
          )}
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

      <AccountQuickActions
        accountIds={perspectiveAccountIds}
        paymentMethods={paymentMethods}
        rentalOptions={rentalOptions}
        roomBookingOptions={roomBookingOptions}
        expenseCategories={expenseCategories}
        transferAccounts={transferOptions.options}
        transferBalances={transferOptions.balances}
        usdRate={usdRate?.rate ?? null}
        btcUsdPrice={btcPrice?.usd ?? null}
      />

      <BalanceHistorySection points={balanceHistory} period={period} granularity={granularity} />

      {fundMovements && (
        <FundsSection paymentMethodId={id} balance={fundBalance(fundMovements)} movements={fundMovements} />
      )}

      <AccountLedgerMonths
        groups={groups}
        perspectiveAccountIds={perspectiveAccountIds}
        currentMonthKey={formatDateInput(new Date()).slice(0, 7)}
        paymentMethods={paymentMethods}
        expenseCategories={expenseCategories}
        fundMovements={fundMovements}
      />

      <ButtonLink href="/caja" variant="secondary">
        Volver a Caja
      </ButtonLink>
    </div>
  );
}

/**
 * Página de una cuenta Bitcoin (ver `PaymentMethod.isBitcoin`): saldo en BTC,
 * su valor aproximado en dólares con el precio del día, lo aportado neto, y
 * los traspasos (la única forma de moverla: comprar o vender BTC).
 */
async function BitcoinAccountView({
  id,
  canSeeFinanceOnly,
  period,
  granularity,
}: {
  id: string;
  canSeeFinanceOnly: boolean;
  period: BalanceHistoryPeriod;
  granularity: BalanceHistoryGranularity;
}) {
  const [bitcoinAccounts, accounts, safeBalance, usdRate, btcPrice, transfers, balanceHistory] = await Promise.all([
    getBitcoinAccountBalances(canSeeFinanceOnly),
    getOwnAccountBalances(canSeeFinanceOnly),
    getSafeBalance(),
    getCurrentUsdRate(),
    getBtcPrice(),
    financeOnlyAccountIds(canSeeFinanceOnly).then((ids) =>
      getAccountTransfers({ accountId: id, limit: 100, maskAccountIds: ids }),
    ),
    getOwnAccountBalanceHistory(id, period, granularity),
  ]);
  const account = bitcoinAccounts.find((a) => a.id === id);
  if (!account) notFound();

  const transferOptions = buildTransferOptions(accounts, safeBalance, bitcoinAccounts);
  const perspectiveAccountIds = [account.id, ...account.subaccounts.map((s) => s.id)];
  const fixedAccounts = perspectiveAccountIds.flatMap((accountId) =>
    transferOptions.options.filter((a) => a.id === accountId),
  );
  const contributed = netContributedText(account.netContributed);

  return (
    <div className="flex flex-col gap-6">
      <CajaSectionNav active="saldos" />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{account.name}</h1>
            {account.financeOnly && <FinanceOnlyBadge />}
          </div>
          <p className="text-sm text-foreground/60">Cuenta en Bitcoin: no suma al saldo disponible.</p>
          {account.financeOnly && (
            <p className="text-sm text-foreground/60">Solo la ven Finanzas, Socio y el propietario.</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xl font-bold text-orange-600 dark:text-orange-400">{formatBtc(account.btc)}</p>
          {btcPrice && (
            <p className="mt-0.5 text-xs text-foreground/60">
              ≈ {formatMoney(account.btc * btcPrice.usd, "usd")} hoy
            </p>
          )}
          <p className="mt-0.5 text-xs text-foreground/50">Aportado (neto): {contributed ?? "—"}</p>
        </div>
      </div>

      <TransferLauncher
        accounts={transferOptions.options}
        balances={transferOptions.balances}
        usdRate={usdRate?.rate ?? null}
        btcUsdPrice={btcPrice?.usd ?? null}
        fixedAccounts={fixedAccounts}
        buttonClassName="w-full"
      />
      <p className="-mt-3 text-xs text-foreground/50">
        Comprar: &quot;Entra a esta cuenta&quot;, desde la cuenta con la que pagaste. Vender: &quot;Sale de esta
        cuenta&quot;, hacia la cuenta donde entra la plata. La ganancia o pérdida queda en la diferencia, como en un
        cambio de moneda.
        {btcPrice
          ? ` Precio de referencia: 1 BTC ≈ ${formatMoney(btcPrice.usd, "usd")} (CoinGecko).`
          : " No se pudo obtener el precio del BTC en este momento."}
      </p>

      <BalanceHistorySection
        points={balanceHistory}
        period={period}
        granularity={granularity}
        showFiat={false}
        showBtc
      />

      <div className="flex flex-col gap-2">
        <SectionTitle>Traspasos</SectionTitle>
        <TransferList
          transfers={transfers}
          perspectiveAccountIds={perspectiveAccountIds}
          emptyText="Todavía no hay compras ni ventas."
        />
      </div>

      <ButtonLink href="/caja" variant="secondary">
        Volver a Caja
      </ButtonLink>
    </div>
  );
}

/** "Evolución del saldo" de una cuenta: selector de período/granularidad (por URL) + gráfico. */
function BalanceHistorySection({
  points,
  period,
  granularity,
  showFiat = true,
  showBtc = false,
}: {
  points: BalancePoint[];
  period: BalanceHistoryPeriod;
  granularity: BalanceHistoryGranularity;
  showFiat?: boolean;
  showBtc?: boolean;
}) {
  return (
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
      <BalanceHistoryChart points={points} granularity={granularity} showFiat={showFiat} showBtc={showBtc} />
    </div>
  );
}
