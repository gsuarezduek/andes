import { formatArs } from "@/lib/contract";
import { formatDateTime } from "@/lib/datetime";
import { cashPeriodSearch } from "@/lib/cash";
import { SectionTitle } from "@/components/ui/section-title";
import { CashMovementsBoard, type PaymentMethodOption } from "./cash-movements-board";
import type { CashPeriodDetail as CashPeriodDetailData, CashMovementEditRow, CashPeriod } from "@/lib/cash";

export function CashPeriodDetail({
  data,
  edits,
  paymentMethods,
  period,
}: {
  data: CashPeriodDetailData;
  edits: CashMovementEditRow[];
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
          <p className="text-lg font-semibold text-emerald-600">{formatArs(data.totalIncome)}</p>
        </div>
        <div className="rounded-lg border border-foreground/10 p-3">
          <p className="text-xs text-foreground/50">Egresos</p>
          <p className="text-lg font-semibold text-red-600">{formatArs(data.totalExpense)}</p>
        </div>
        <div className="rounded-lg border border-foreground/10 p-3">
          <p className="text-xs text-foreground/50">Neto</p>
          <p className="text-lg font-semibold">{formatArs(data.net)}</p>
        </div>
      </div>

      <CashMovementsBoard incomes={data.incomes} expenses={data.expenses} paymentMethods={paymentMethods} period={period} />

      <EditHistorySection edits={edits} />
    </div>
  );
}

function editSummary(edit: CashMovementEditRow): string {
  if (edit.action === "deleted") {
    const note = edit.changes?.find((c) => c.field === "Motivo")?.to;
    const base = `Eliminado — ${edit.movementDescription} (${formatArs(edit.movementAmount)})`;
    return note ? `${base} · Motivo: ${note}` : base;
  }
  return (edit.changes ?? []).map((c) => `${c.field}: ${c.from} → ${c.to}`).join(" · ");
}

function EditHistorySection({ edits }: { edits: CashMovementEditRow[] }) {
  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>Historial de ediciones</SectionTitle>
      {edits.length === 0 ? (
        <p className="rounded-lg border border-foreground/10 px-3 py-2 text-sm text-foreground/50">
          Sin ediciones en este período.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {edits.map((e) => (
            <li key={e.id} className="rounded-lg border border-foreground/10 px-3 py-2 text-sm">
              <p className={e.action === "deleted" ? "text-red-600" : ""}>{editSummary(e)}</p>
              <p className="mt-1 text-xs text-foreground/50">
                {e.editedByName} · {formatDateTime(e.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
