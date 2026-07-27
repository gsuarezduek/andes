import { ButtonLink } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui/section-title";
import { formatArs } from "@/lib/contract";
import { formatDateTime } from "@/lib/datetime";
import { MovementRow } from "./movement-row";
import type { CashMonthDetail as CashMonthDetailData, CashMovementRow, CashMovementEditRow } from "@/lib/cash";

type PaymentMethodOption = { id: string; name: string; requiresNote?: boolean };

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
        <div className="flex gap-2">
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
          <p className="text-xs text-foreground/50">Cobros</p>
          <p className="text-lg font-semibold text-emerald-600">{formatArs(data.totalIncome)}</p>
        </div>
        <div className="rounded-lg border border-foreground/10 p-3">
          <p className="text-xs text-foreground/50">Pagos</p>
          <p className="text-lg font-semibold text-red-600">{formatArs(data.totalExpense)}</p>
        </div>
        <div className="rounded-lg border border-foreground/10 p-3">
          <p className="text-xs text-foreground/50">Neto</p>
          <p className="text-lg font-semibold">{formatArs(data.net)}</p>
        </div>
      </div>

      {/* Pagos a la izquierda, Cobros a la derecha. */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <MovementColumn
          title={`Pagos (${data.expenses.length})`}
          rows={data.expenses}
          tone="red"
          paymentMethods={paymentMethods}
        />
        <MovementColumn
          title={`Cobros (${data.incomes.length})`}
          rows={data.incomes}
          tone="emerald"
          paymentMethods={paymentMethods}
        />
      </div>

      <EditHistorySection edits={edits} />
    </div>
  );
}

function MovementColumn({
  title,
  rows,
  tone,
  paymentMethods,
}: {
  title: string;
  rows: CashMovementRow[];
  tone: "emerald" | "red";
  paymentMethods: PaymentMethodOption[];
}) {
  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>{title}</SectionTitle>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-foreground/10 px-3 py-2 text-sm text-foreground/50">
          Sin movimientos.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            // La key incluye los campos editables: tras guardar una edición,
            // cambia y el componente se remonta con los valores nuevos (evita
            // quedar con el form de edición pegado a los datos viejos).
            <MovementRow
              key={`${r.id}:${r.description}:${r.amount}:${r.paymentMethodName}:${r.paymentMethodNote ?? ""}`}
              movement={r}
              tone={tone}
              paymentMethods={paymentMethods}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function editSummary(edit: CashMovementEditRow): string {
  if (edit.action === "deleted") {
    return `Eliminado — ${edit.movementDescription} (${formatArs(edit.movementAmount)})`;
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
