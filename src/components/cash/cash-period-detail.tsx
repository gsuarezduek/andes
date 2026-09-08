import { formatMoney } from "@/lib/contract";
import { formatDateTime } from "@/lib/datetime";
import { cashPeriodSearch } from "@/lib/cash";
import { SectionTitle } from "@/components/ui/section-title";
import { CashMovementsBoard, type PaymentMethodOption } from "./cash-movements-board";
import { CurrencyTotalsDisplay } from "./currency-totals-display";
import type { CashPeriodDetail as CashPeriodDetailData, DeletedCashMovementRow, CashPeriod } from "@/lib/cash";

export function CashPeriodDetail({
  data,
  deleted,
  paymentMethods,
  period,
}: {
  data: CashPeriodDetailData;
  deleted: DeletedCashMovementRow[];
  paymentMethods: PaymentMethodOption[];
  period: CashPeriod;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{data.periodLabel}</h2>
        <a className="text-xs font-medium underline" href={`/api/caja/export?${cashPeriodSearch(period)}`}>
          Exportar CSV
        </a>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg border border-foreground/10 p-3">
          <p className="text-xs text-foreground/50">Ingresos</p>
          <CurrencyTotalsDisplay totals={data.totalIncome} toneClass="text-emerald-600" />
        </div>
        <div className="rounded-lg border border-foreground/10 p-3">
          <p className="text-xs text-foreground/50">Egresos</p>
          <CurrencyTotalsDisplay totals={data.totalExpense} toneClass="text-red-600" />
        </div>
        <div className="rounded-lg border border-foreground/10 p-3">
          <p className="text-xs text-foreground/50">Neto</p>
          <CurrencyTotalsDisplay totals={data.net} />
        </div>
      </div>

      <CashMovementsBoard incomes={data.incomes} expenses={data.expenses} paymentMethods={paymentMethods} period={period} />

      <DeletedSection deleted={deleted} />
    </div>
  );
}

/**
 * Movimientos eliminados del período — a diferencia de una edición (que se
 * ve en el lugar mismo del movimiento, ver `MovementMetaLine`), un borrado
 * hace desaparecer la fila del listado, así que necesita este lugar aparte.
 */
function DeletedSection({ deleted }: { deleted: DeletedCashMovementRow[] }) {
  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>Movimientos eliminados</SectionTitle>
      {deleted.length === 0 ? (
        <p className="rounded-lg border border-foreground/10 px-3 py-2 text-sm text-foreground/50">
          Sin movimientos eliminados en este período.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {deleted.map((d) => (
            <li key={d.id} className="rounded-lg border border-foreground/10 px-3 py-2 text-sm">
              <p className="text-red-600">
                {d.movementDescription} ({formatMoney(d.movementAmount, d.movementCurrency)}) · Motivo: {d.reason}
              </p>
              <p className="mt-1 text-xs text-foreground/50">
                Eliminado por: {d.deletedByName} · {formatDateTime(d.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
