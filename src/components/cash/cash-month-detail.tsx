import { ButtonLink } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui/section-title";
import { formatArs } from "@/lib/contract";
import { formatDateTime } from "@/lib/datetime";
import { CashMovementsBoard, type PaymentMethodOption } from "./cash-movements-board";
import type { CashMonthDetail as CashMonthDetailData, CashMovementEditRow } from "@/lib/cash";

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("es-AR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function CashMonthDetail({
  data,
  edits,
  paymentMethods,
  todayMonth,
}: {
  data: CashMonthDetailData;
  edits: CashMovementEditRow[];
  paymentMethods: PaymentMethodOption[];
  todayMonth: string;
}) {
  const nav = (target: string) => `/caja?month=${target}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{monthLabel(data.month)}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <a
            className="text-xs font-medium underline"
            href={`/api/caja/export?month=${data.month}`}
          >
            Exportar CSV
          </a>
          <ButtonLink variant="secondary" href={nav(data.prevMonth)}>
            ← Anterior
          </ButtonLink>
          {data.month !== todayMonth && (
            <ButtonLink variant="secondary" href={nav(todayMonth)}>
              Hoy
            </ButtonLink>
          )}
          <ButtonLink variant="secondary" href={nav(data.nextMonth)}>
            Siguiente →
          </ButtonLink>
        </div>
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

      <CashMovementsBoard incomes={data.incomes} expenses={data.expenses} paymentMethods={paymentMethods} />

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
          Sin ediciones este mes.
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
