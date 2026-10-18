import { AccountCard } from "./account-card";
import { TransferList } from "./transfer-list";
import { BalanceHistoryChart } from "./balance-history-chart";
import { SectionTitle } from "@/components/ui/section-title";
import { formatMoney } from "@/lib/contract";
import { SAFE_ACCOUNT_NAME } from "@/lib/account-transfers";
import { CURRENCIES, emptyCurrencyTotals, subtractCurrencyTotals, type CurrencyTotals } from "@/lib/currency";
import type { OwnAccountBalance } from "@/lib/cash";
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
 * total (`getTotalOwnBalanceHistory`) — "Mover entre cuentas" ya no vive acá,
 * subió al header de `/caja`, junto al valor del USD. Solo admin (ver
 * `caja/page.tsx`): a diferencia de Proveedores/Asociados, esto es la
 * posición de plata real de la empresa.
 */
export function AccountsSection({
  accounts,
  transfers,
  totalBalanceHistory,
  balPeriod,
  balGranularity,
  safeBalance,
  safeMonthIncome,
  safeMonthExpense,
}: {
  accounts: OwnAccountBalance[];
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
  }
  total.ars += safeBalance.ars;
  total.usd += safeBalance.usd;
  const totalInAccount = subtractCurrencyTotals(total, totalInvested);
  const anyGuarantee = totalGuarantee.ars !== 0 || totalGuarantee.usd !== 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-foreground/10 bg-foreground/5 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-foreground/50">Saldo total (hoy)</p>
        <p className="text-2xl font-bold">
          {CURRENCIES.filter((c) => c === "ars" || total[c] !== 0)
            .map((c) => formatMoney(total[c], c))
            .join(" · ")}
        </p>
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
        <BalanceHistoryChart points={totalBalanceHistory} granularity={balGranularity} />
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

      <div className="flex flex-col gap-2">
        <SectionTitle>Últimos traspasos</SectionTitle>
        <TransferList transfers={transfers} />
      </div>
    </div>
  );
}
