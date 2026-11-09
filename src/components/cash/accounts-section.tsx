import { AccountCard } from "./account-card";
import { BitcoinAccountCard } from "./bitcoin-account-card";
import { FinanceOnlyBadge } from "./finance-only-badge";
import { TransferList } from "./transfer-list";
import { BalanceHistoryChart } from "./balance-history-chart";
import { SectionTitle } from "@/components/ui/section-title";
import { formatBtc, formatMoney } from "@/lib/contract";
import { SAFE_ACCOUNT_NAME } from "@/lib/account-transfers";
import { CURRENCIES, emptyCurrencyTotals, subtractCurrencyTotals, type CurrencyTotals } from "@/lib/currency";
import type { BitcoinAccountBalance, OwnAccountBalance } from "@/lib/cash";
import type { BtcPrice } from "@/lib/btc-price";
import type { AccountTransferRow } from "@/lib/account-transfers-queries";
import {
  BALANCE_HISTORY_PERIOD_OPTIONS,
  type BalanceHistoryGranularity,
  type BalanceHistoryPeriod,
  type BalancePoint,
} from "@/lib/balance-history";

/**
 * Saldo de cada cuenta propia (Efectivo, banco, Mercado Pago, etc.) más la
 * Caja fuerte (efectivo físico — ya no tiene su propia pestaña, ver v44) —
 * una `AccountCard` cuadrada por cuenta, varias por fila, que linkea a su
 * historial completo (`/caja/saldos/[id]`, o `/caja/saldos/caja-fuerte`).
 * Arriba, el saldo total de hoy (todas las cuentas + Caja fuerte, separado
 * por moneda), si alguna cuenta tiene fondos de inversión el mismo
 * desglose "En cuenta"/"En fondos" agregado de todas ellas, y si hay
 * garantías activas en alguna cuenta el total agregado "En garantías" (en
 * rojo — es plata del cliente, no de la empresa; ver
 * `OwnAccountBalance.guaranteeBalance`). Debajo, la evolución de ese saldo
 * total (`getTotalOwnBalanceHistory`). Las cuentas Bitcoin van en su propia
 * sección al final y NO suman a pesos ni dólares (no es plata disponible): el
 * total muestra el BTC como una moneda más ("₿ 0,3") con su aclaración, y el
 * gráfico suma una serie en BTC — todo eso solo si quien mira tiene alguna
 * cuenta Bitcoin visible (las de Finanzas ni llegan para el resto). "Mover entre cuentas" ya no vive acá,
 * subió al header de `/caja`, junto al valor del USD. Solo admin (ver
 * `caja/page.tsx`): a diferencia de Proveedores/Asociados, esto es la
 * posición de plata real de la empresa.
 */
export function AccountsSection({
  accounts,
  bitcoinAccounts = [],
  btcPrice = null,
  transfers,
  totalBalanceHistory,
  balPeriod,
  balGranularity,
  safeBalance,
  safeMonthIncome,
  safeMonthExpense,
}: {
  accounts: OwnAccountBalance[];
  /** Cuentas en bitcoins (ver `PaymentMethod.isBitcoin`) — se muestran aparte. */
  bitcoinAccounts?: BitcoinAccountBalance[];
  /** Precio de 1 BTC en dólares; null si no hay cuentas Bitcoin o no se pudo obtener. */
  btcPrice?: BtcPrice | null;
  /** Saldo actual de la Caja fuerte — también es origen/destino de un traspaso. */
  safeBalance: CurrencyTotals;
  safeMonthIncome: CurrencyTotals;
  safeMonthExpense: CurrencyTotals;
  /** Últimos traspasos entre cuentas ("Mover entre cuentas"). */
  transfers: AccountTransferRow[];
  totalBalanceHistory: BalancePoint[];
  balPeriod: BalanceHistoryPeriod;
  balGranularity: BalanceHistoryGranularity;
}) {
  const total = emptyCurrencyTotals();
  const totalInvested = emptyCurrencyTotals();
  const totalGuarantee = emptyCurrencyTotals();
  // Solo llegan cuentas de Finanzas si quien mira tiene acceso: el resto ve
  // un total sin ellas, por eso se aclara cuánto aportan.
  const totalFinanceOnly = emptyCurrencyTotals();
  let anyFinanceOnly = false;
  let anyInvested = false;
  for (const a of accounts) {
    total.ars += a.balance.ars;
    total.usd += a.balance.usd;
    if (a.investedBalance) {
      anyInvested = true;
      totalInvested.ars += a.investedBalance.ars;
      totalInvested.usd += a.investedBalance.usd;
    }
    totalGuarantee.ars += a.guaranteeBalance.ars;
    totalGuarantee.usd += a.guaranteeBalance.usd;
    if (a.financeOnly) {
      anyFinanceOnly = true;
      totalFinanceOnly.ars += a.balance.ars;
      totalFinanceOnly.usd += a.balance.usd;
    }
  }
  total.ars += safeBalance.ars;
  total.usd += safeBalance.usd;
  const totalInAccount = subtractCurrencyTotals(total, totalInvested);
  const anyGuarantee = totalGuarantee.ars !== 0 || totalGuarantee.usd !== 0;
  const totalBtc = bitcoinAccounts.reduce((sum, a) => sum + a.btc, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-foreground/10 bg-foreground/5 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-foreground/50">Saldo total (hoy)</p>
        <p className="text-2xl font-bold">
          {[
            ...CURRENCIES.filter((c) => c === "ars" || total[c] !== 0).map((c) => formatMoney(total[c], c)),
            // Solo si quien mira tiene alguna cuenta Bitcoin visible: si no, ni "₿ 0".
            ...(bitcoinAccounts.length > 0 ? [formatBtc(totalBtc)] : []),
          ].join(" · ")}
        </p>
        {bitcoinAccounts.length > 0 && (
          <p className="mt-1 text-xs text-orange-600 dark:text-orange-400">
            ₿ no es plata disponible
            {btcPrice ? ` · ≈ ${formatMoney(totalBtc * btcPrice.usd, "usd")} hoy` : ""}
          </p>
        )}
        {anyInvested && (
          <p className="mt-1 text-xs text-foreground/50">
            En cuenta:{" "}
            {CURRENCIES.filter((c) => c === "ars" || totalInAccount[c] !== 0)
              .map((c) => formatMoney(totalInAccount[c], c))
              .join(" · ")}{" "}
            · En fondos:{" "}
            {CURRENCIES.filter((c) => c === "ars" || totalInvested[c] !== 0)
              .map((c) => formatMoney(totalInvested[c], c))
              .join(" · ")}
          </p>
        )}
        {anyFinanceOnly && (
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-foreground/60">
            <FinanceOnlyBadge />
            <span>
              Incluye{" "}
              {CURRENCIES.filter((c) => c === "ars" || totalFinanceOnly[c] !== 0)
                .map((c) => formatMoney(totalFinanceOnly[c], c))
                .join(" · ")}{" "}
              en cuentas de Finanzas — quien no tiene ese acceso ve el total sin ellas.
            </span>
          </p>
        )}
        {anyGuarantee && (
          <p className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
            En garantías:{" "}
            {CURRENCIES.filter((c) => c === "ars" || totalGuarantee[c] !== 0)
              .map((c) => formatMoney(totalGuarantee[c], c))
              .join(" · ")}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle>Evolución del saldo total</SectionTitle>
          <form className="flex items-center gap-2">
            <input type="hidden" name="tab" value="saldos" />
            <select
              name="balPeriod"
              defaultValue={balPeriod}
              className="h-9 rounded-lg border border-foreground/15 bg-transparent px-2 text-sm outline-none focus:border-foreground/40"
            >
              {BALANCE_HISTORY_PERIOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              name="balGranularity"
              defaultValue={balGranularity}
              disabled={balPeriod === "12m"}
              className="h-9 rounded-lg border border-foreground/15 bg-transparent px-2 text-sm outline-none focus:border-foreground/40 disabled:opacity-50"
            >
              <option value="daily">Diario</option>
              <option value="weekly">Semanal</option>
            </select>
            <button className="h-9 rounded-lg border border-foreground/15 px-3 text-sm font-medium">Aplicar</button>
          </form>
        </div>
        {balPeriod === "12m" && (
          <p className="text-xs text-foreground/50">
            En el último año se muestra siempre semanal (diario sería demasiado ruido).
          </p>
        )}
        <BalanceHistoryChart
          points={totalBalanceHistory}
          granularity={balGranularity}
          showBtc={bitcoinAccounts.length > 0}
        />
      </div>

      {accounts.length === 0 ? (
        <p className="rounded-lg border border-foreground/10 px-3 py-2 text-sm text-foreground/50">
          Todavía no hay cuentas propias configuradas. Agregalas en Configuración → Medios de pago (Tipo de cuenta:
          Propia).
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {accounts.map((a) => (
            <AccountCard
              key={a.id}
              href={`/caja/saldos/${a.id}`}
              name={a.name}
              caption={a.subaccounts.length > 0 ? `Incluye ${a.subaccounts.map((s) => s.name).join(", ")}` : undefined}
              balance={a.balance}
              investedBalance={a.investedBalance}
              guaranteeBalance={a.guaranteeBalance}
              monthIncome={a.monthIncome}
              monthExpense={a.monthExpense}
              financeOnly={a.financeOnly}
            />
          ))}
          <AccountCard
            href="/caja/saldos/caja-fuerte"
            name={SAFE_ACCOUNT_NAME}
            caption="Efectivo físico"
            balance={safeBalance}
            monthIncome={safeMonthIncome}
            monthExpense={safeMonthExpense}
          />
        </div>
      )}

      {bitcoinAccounts.length > 0 && (
        <div className="flex flex-col gap-3">
          <div>
            <SectionTitle>Bitcoin</SectionTitle>
            <p className="text-xs text-foreground/50">
              No es plata disponible: no suma al saldo total. Se compra y se vende con &quot;Mover entre cuentas&quot;.
              {btcPrice &&
                ` Precio de referencia: 1 BTC ≈ ${formatMoney(btcPrice.usd, "usd")} (CoinGecko, se actualiza cada 5 minutos).`}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {bitcoinAccounts.map((a) => (
              <BitcoinAccountCard
                key={a.id}
                href={`/caja/saldos/${a.id}`}
                name={a.name}
                caption={a.subaccounts.length > 0 ? `Incluye ${a.subaccounts.map((s) => s.name).join(", ")}` : undefined}
                btc={a.btc}
                netContributed={a.netContributed}
                btcUsdPrice={btcPrice?.usd ?? null}
                financeOnly={a.financeOnly}
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <SectionTitle>Últimos traspasos</SectionTitle>
        <TransferList transfers={transfers} />
      </div>
    </div>
  );
}
