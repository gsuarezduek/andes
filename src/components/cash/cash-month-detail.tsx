import { ButtonLink } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui/section-title";
import { formatArs } from "@/lib/contract";
import { formatDateTime } from "@/lib/datetime";
import type { CashMonthDetail as CashMonthDetailData, CashMovementRow } from "@/lib/cash";

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
  todayMonth,
}: {
  data: CashMonthDetailData;
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
        <MovementColumn title={`Pagos (${data.expenses.length})`} rows={data.expenses} tone="red" />
        <MovementColumn title={`Cobros (${data.incomes.length})`} rows={data.incomes} tone="emerald" />
      </div>
    </div>
  );
}

function MovementColumn({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: CashMovementRow[];
  tone: "emerald" | "red";
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
            <li key={r.id} className="rounded-lg border border-foreground/10 px-3 py-2 text-sm">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 whitespace-pre-wrap">{r.description}</p>
                <p
                  className={`shrink-0 font-semibold ${tone === "emerald" ? "text-emerald-600" : "text-red-600"}`}
                >
                  {formatArs(r.amount)}
                </p>
              </div>
              <p className="mt-1 text-xs text-foreground/50">
                {r.paymentMethodName}
                {r.paymentMethodNote ? ` (${r.paymentMethodNote})` : ""}
                {r.rentalClientName ? ` · ${r.rentalClientName}` : ""} · {r.createdByName} ·{" "}
                {formatDateTime(r.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
