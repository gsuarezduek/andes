import { SectionTitle } from "@/components/ui/section-title";
import { CashPeriodPicker } from "./cash-period-picker";
import { CurrencyTotalsDisplay } from "./currency-totals-display";
import { MovementMetaLine } from "./movement-meta-line";
import { formatMoney } from "@/lib/contract";
import type { CashMovementRow } from "@/lib/cash";
import type { CashPeriod } from "@/lib/cash-period";
import type { CurrencyTotals } from "@/lib/currency";

/**
 * Ingresos del período — visibles para cualquier rol sin restricción (a
 * diferencia de Egresos, que para un no-admin siguen acotados a "Mis
 * movimientos"). Mismo período/navegación que la vista admin, sin filtro por
 * cuenta ni edición (eso sigue siendo solo admin, ver `CashPeriodDetail`).
 */
export function IncomesBoard({
  incomes,
  totalIncome,
  period,
}: {
  incomes: CashMovementRow[];
  totalIncome: CurrencyTotals;
  period: CashPeriod;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionTitle>Ingresos</SectionTitle>
        <CashPeriodPicker period={period} />
      </div>

      <div className="rounded-lg border border-foreground/10 p-3 text-center">
        <p className="text-xs text-foreground/50">Total</p>
        <CurrencyTotalsDisplay totals={totalIncome} toneClass="text-emerald-600" />
      </div>

      {incomes.length === 0 ? (
        <p className="rounded-lg border border-foreground/10 px-3 py-2 text-sm text-foreground/50">
          Sin ingresos en este período.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {incomes.map((r) => (
            <li key={r.id} className="rounded-lg border border-foreground/10 px-3 py-2 text-sm">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 whitespace-pre-wrap">{r.description}</p>
                <p className="shrink-0 font-semibold text-emerald-600">{formatMoney(r.amount, r.currency)}</p>
              </div>
              <MovementMetaLine movement={r} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
