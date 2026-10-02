import type { PaymentMethodOwnership } from "@prisma/client";
import { SectionTitle } from "@/components/ui/section-title";
import { CashPeriodPicker } from "./cash-period-picker";
import { CurrencyTotalsDisplay } from "./currency-totals-display";
import { MovementRow } from "./movement-row";
import { movementRowKey } from "./movement-row-key";
import type { CashMovementRow } from "@/lib/cash";
import type { CashPeriod } from "@/lib/cash-period";
import type { CurrencyTotals } from "@/lib/currency";

type PaymentMethodOption = { id: string; name: string; requiresNote?: boolean; ownership: PaymentMethodOwnership };
type ExpenseCategoryOption = { id: string; name: string };

/**
 * Ingresos del período — visibles para cualquier rol sin restricción (a
 * diferencia de Egresos, que para un no-admin siguen acotados a "Mis
 * movimientos"). Mismo período/navegación que la vista admin. Editable por
 * cualquier rol (ver `updateCashMovement`/`deleteCashMovement`), aunque el
 * ingreso lo haya cargado otra persona.
 */
export function IncomesBoard({
  incomes,
  totalIncome,
  period,
  paymentMethods,
  expenseCategories,
}: {
  incomes: CashMovementRow[];
  totalIncome: CurrencyTotals;
  period: CashPeriod;
  paymentMethods: PaymentMethodOption[];
  expenseCategories: ExpenseCategoryOption[];
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
            <MovementRow
              key={movementRowKey(r)}
              movement={r}
              tone="emerald"
              paymentMethods={paymentMethods}
              expenseCategories={expenseCategories}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
