import { formatMoney } from "@/lib/contract";
import { CURRENCIES, type CurrencyTotals } from "@/lib/currency";

/**
 * "Le debemos $X" / "A favor $X" por moneda con saldo — nada si está en
 * cero. Compartido por `ProviderCard`/`AssociateCard` (mismo mecanismo de
 * cuenta corriente, ver `src/lib/third-party-accounts.ts`).
 */
export function BalanceLine({ balance }: { balance: CurrencyTotals }) {
  const entries = CURRENCIES.filter((c) => balance[c] !== 0);
  if (entries.length === 0) {
    return <span className="text-sm text-foreground/50">Sin saldo pendiente</span>;
  }
  return (
    <span className="flex flex-col items-end gap-0.5 text-sm font-semibold">
      {entries.map((c) => (
        <span key={c} className={balance[c] > 0 ? "text-amber-700 dark:text-amber-400" : "text-emerald-600"}>
          {balance[c] > 0 ? "Le debemos " : "A favor "}
          {formatMoney(Math.abs(balance[c]), c)}
        </span>
      ))}
    </span>
  );
}
