import { SectionTitle } from "@/components/ui/section-title";
import { formatMoney } from "@/lib/contract";
import { formatDateTime } from "@/lib/datetime";
import type { CashMovementRow } from "@/lib/cash";

export function CashOwnList({ items }: { items: CashMovementRow[] }) {
  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>Mis movimientos de este mes</SectionTitle>
      {items.length === 0 ? (
        <p className="rounded-lg border border-foreground/10 px-3 py-2 text-sm text-foreground/50">
          Todavía no cargaste movimientos este mes.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((r) => (
            <li key={r.id} className="rounded-lg border border-foreground/10 px-3 py-2 text-sm">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 whitespace-pre-wrap">{r.description}</p>
                <p
                  className={`shrink-0 font-semibold ${r.type === "income" ? "text-emerald-600" : "text-red-600"}`}
                >
                  {r.type === "income" ? "+" : "-"}
                  {formatMoney(r.amount, r.currency)}
                </p>
              </div>
              <p className="mt-1 text-xs text-foreground/50">
                {r.paymentMethodName}
                {r.paymentMethodNote ? ` (${r.paymentMethodNote})` : ""}
                {r.recipientPaymentMethodName ? ` → ${r.recipientPaymentMethodName}` : ""}
                {r.recipientPaymentMethodNote ? ` (${r.recipientPaymentMethodNote})` : ""}
                {r.rentalClientName ? ` · ${r.rentalClientName}` : ""} · {formatDateTime(r.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
