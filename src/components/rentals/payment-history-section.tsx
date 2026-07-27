import { formatArs } from "@/lib/contract";
import { formatDateTime } from "@/lib/datetime";

type PaymentHistoryRow = {
  id: string;
  description: string;
  amount: number;
  paymentMethodName: string;
  paymentMethodNote: string | null;
  createdByName: string | null;
  createdAt: Date;
};

/** Historial de cobros de esta reserva (entrega, devolución y pagos sueltos
 *  cargados desde el botón "Agregar pago") — quién lo cargó y cuándo. Misma
 *  fuente que Caja (CashMovement.rentalId), así nunca se desincroniza. */
export function PaymentHistorySection({ movements }: { movements: PaymentHistoryRow[] }) {
  if (movements.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-foreground/60">Pagos registrados</p>
      <ul className="divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
        {movements.map((m) => (
          <li key={m.id} className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm">
            <div>
              <p>
                {m.paymentMethodName}
                {m.paymentMethodNote ? ` (${m.paymentMethodNote})` : ""}
              </p>
              <p className="text-xs text-foreground/50">
                {m.createdByName ?? "—"} · {formatDateTime(m.createdAt)}
              </p>
            </div>
            <span className="shrink-0 font-medium">{formatArs(m.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
