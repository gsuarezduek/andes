import type { PaymentMethodOwnership } from "@prisma/client";
import { SectionTitle } from "@/components/ui/section-title";
import { MovementRow } from "./movement-row";
import { CurrencyTotalsDisplay } from "./currency-totals-display";
import type { GuaranteeLedger } from "@/lib/cash";

type PaymentMethodOption = { id: string; name: string; requiresNote?: boolean; ownership: PaymentMethodOwnership };
type ExpenseCategoryOption = { id: string; name: string };

/**
 * Garantías/depósitos (ver `RentalPayment.isGuarantee` en contract.ts):
 * separadas de Movimientos porque no son un cobro/pago real del negocio,
 * sino plata que hay que devolver — mismo criterio de "posición real de la
 * empresa" que Saldos/Caja fuerte (histórico completo, admin-only). Se
 * cargan desde "Agregar pago" (entrega/devolución, detalle de la reserva) o
 * marcando la casilla al cargar un Ingreso/Egreso en Movimientos — acá solo
 * se ven y se editan/eliminan (mismo `MovementRow` que el resto de Caja).
 */
export function GuaranteesSection({
  ledger,
  paymentMethods,
  expenseCategories,
}: {
  ledger: GuaranteeLedger;
  paymentMethods: PaymentMethodOption[];
  expenseCategories: ExpenseCategoryOption[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-foreground/50">
        Se cargan desde &quot;Agregar pago&quot; (entrega, devolución o el detalle de una reserva) marcando &quot;Es
        una garantía&quot;, o desde Movimientos → +Ingreso/+Egreso con la misma casilla — por ejemplo, para anotar la
        devolución de una garantía ya tomada.
      </p>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg border border-foreground/10 p-3">
          <p className="text-xs text-foreground/50">Tomadas</p>
          <CurrencyTotalsDisplay totals={ledger.totalIncome} toneClass="text-emerald-600" />
        </div>
        <div className="rounded-lg border border-foreground/10 p-3">
          <p className="text-xs text-foreground/50">Devueltas</p>
          <CurrencyTotalsDisplay totals={ledger.totalExpense} toneClass="text-red-600" />
        </div>
        <div className="rounded-lg border border-foreground/10 p-3">
          <p className="text-xs text-foreground/50">En poder de la empresa</p>
          <CurrencyTotalsDisplay totals={ledger.held} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className="flex flex-col gap-2">
          <SectionTitle>Tomadas ({ledger.incomes.length})</SectionTitle>
          {ledger.incomes.length === 0 ? (
            <p className="rounded-lg border border-foreground/10 px-3 py-2 text-sm text-foreground/50">
              Sin garantías tomadas.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {ledger.incomes.map((r) => (
                <MovementRow
                  key={`${r.id}:${r.description}:${r.amount}:${r.currency}:${r.paymentMethodName}`}
                  movement={r}
                  tone="emerald"
                  paymentMethods={paymentMethods}
                  expenseCategories={expenseCategories}
                />
              ))}
            </ul>
          )}
        </section>
        <section className="flex flex-col gap-2">
          <SectionTitle>Devueltas ({ledger.expenses.length})</SectionTitle>
          {ledger.expenses.length === 0 ? (
            <p className="rounded-lg border border-foreground/10 px-3 py-2 text-sm text-foreground/50">
              Sin garantías devueltas.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {ledger.expenses.map((r) => (
                <MovementRow
                  key={`${r.id}:${r.description}:${r.amount}:${r.currency}:${r.paymentMethodName}`}
                  movement={r}
                  tone="red"
                  paymentMethods={paymentMethods}
                  expenseCategories={expenseCategories}
                />
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
