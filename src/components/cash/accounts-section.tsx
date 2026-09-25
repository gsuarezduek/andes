import { AccountCard } from "./account-card";
import { TransferLauncher, type TransferAccountOption } from "./transfer-launcher";
import { TransferList } from "./transfer-list";
import { SectionTitle } from "@/components/ui/section-title";
import { formatMoney } from "@/lib/contract";
import { SAFE_ACCOUNT_ID, SAFE_ACCOUNT_NAME } from "@/lib/account-transfers";
import { CURRENCIES, emptyCurrencyTotals, type CurrencyTotals } from "@/lib/currency";
import type { OwnAccountBalance } from "@/lib/cash";
import type { AccountTransferRow } from "@/lib/account-transfers-queries";

/**
 * Saldo de cada cuenta propia (Efectivo, banco, Mercado Pago, etc.) más la
 * Caja fuerte (efectivo físico — ya no tiene su propia pestaña, ver v44) —
 * una `AccountCard` cuadrada por cuenta, varias por fila, que linkea a su
 * historial completo (`/caja/saldos/[id]`, o `/caja/saldos/caja-fuerte`).
 * Arriba, el saldo total de hoy (todas las cuentas + Caja fuerte, separado
 * por moneda). Solo admin (ver `caja/page.tsx`): a diferencia de
 * Proveedores/Asociados, esto es la posición de plata real de la empresa.
 */
export function AccountsSection({
  accounts,
  transfers,
  usdRate,
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
  usdRate: number | null;
}) {
  // Cuentas elegibles como origen/destino de un traspaso (principales +
  // subcuentas) y el saldo de cada principal, para avisar si un traspaso
  // dejaría el origen en negativo.
  const options: TransferAccountOption[] = [
    ...accounts.flatMap((a) => [
      { id: a.id, name: a.name, principalId: a.id },
      ...a.subaccounts.map((s) => ({ id: s.id, name: `${a.name} · ${s.name}`, principalId: a.id })),
    ]),
    { id: SAFE_ACCOUNT_ID, name: SAFE_ACCOUNT_NAME, principalId: SAFE_ACCOUNT_ID },
  ];
  const balances = { ...Object.fromEntries(accounts.map((a) => [a.id, a.balance])), [SAFE_ACCOUNT_ID]: safeBalance };

  const total = emptyCurrencyTotals();
  for (const a of accounts) {
    total.ars += a.balance.ars;
    total.usd += a.balance.usd;
  }
  total.ars += safeBalance.ars;
  total.usd += safeBalance.usd;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-foreground/10 bg-foreground/5 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-foreground/50">Saldo total (hoy)</p>
        <p className="text-2xl font-bold">
          {CURRENCIES.filter((c) => c === "ars" || total[c] !== 0)
            .map((c) => formatMoney(total[c], c))
            .join(" · ")}
        </p>
      </div>

      <TransferLauncher accounts={options} balances={balances} usdRate={usdRate} />

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
              monthIncome={a.monthIncome}
              monthExpense={a.monthExpense}
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
