import { formatMoney } from "@/lib/contract";
import type { Currency } from "@/lib/currency";
import { formatDateTime } from "@/lib/datetime";
import { AUTO_IMPORT_CREATOR_LABEL } from "@/lib/cash";
import { ConfirmPaymentInline } from "@/components/rentals/confirm-payment-inline";
import type { ConfirmablePaymentMethod } from "@/components/cash/confirm-payment-method-form";
import { InvoiceRequestControl } from "@/components/cash/invoice-request-control";
import { Badge } from "@/components/ui/badge";

type PaymentHistoryRow = {
  id: string;
  description: string;
  amount: number;
  currency: Currency;
  paymentMethodName: string;
  paymentMethodNote: string | null;
  needsConfirmation: boolean;
  createdByName: string | null;
  createdAt: Date;
  // Facturación (ver Caja → Facturación). `invoiceEligible` = ingreso que no
  // es una garantía (las garantías no se facturan).
  invoiceEligible: boolean;
  needsInvoice: boolean;
  invoicedAt: Date | null;
  invoicingName: string | null;
  invoicingCuit: string | null;
  accountAutoInvoice: boolean;
};

/** Historial de cobros de esta reserva (entrega, devolución y pagos sueltos
 *  cargados desde el botón "Agregar pago") — quién lo cargó y cuándo. Misma
 *  fuente que Caja (CashMovement.rentalId), así nunca se desincroniza. */
export function PaymentHistorySection({
  movements,
  paymentMethods,
}: {
  movements: PaymentHistoryRow[];
  paymentMethods: ConfirmablePaymentMethod[];
}) {
  if (movements.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-foreground/60">
        Pagos registrados
      </p>
      <ul className="divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
        {movements.map((m) => (
          <li key={m.id} className="flex flex-col gap-2 px-4 py-2.5 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p>
                  Cuenta destino: {m.paymentMethodName}
                  {m.paymentMethodNote ? ` (${m.paymentMethodNote})` : ""}
                </p>
                <p className="text-xs text-foreground/50">
                  Cargado por: {m.createdByName ?? AUTO_IMPORT_CREATOR_LABEL} ·{" "}
                  {formatDateTime(m.createdAt)}
                </p>
                {m.needsConfirmation && (
                  <div className="mt-1 flex flex-col items-start gap-1">
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                      Falta confirmar el medio de pago real.
                    </p>
                    <ConfirmPaymentInline
                      movementId={m.id}
                      paymentMethods={paymentMethods}
                    />
                  </div>
                )}
              </div>
              <span className="shrink-0 font-medium">
                {formatMoney(m.amount, m.currency)}
              </span>
            </div>
            {m.invoiceEligible && (
              <div className="flex flex-col items-start gap-1.5">
                {m.needsInvoice && (
                  <span className="flex flex-wrap items-center gap-1.5 text-xs">
                    {m.invoicedAt ? (
                      <Badge tone="emerald">Facturado</Badge>
                    ) : (
                      <Badge tone="amber">A facturar</Badge>
                    )}
                    {(m.invoicingName || m.invoicingCuit) && (
                      <span className="text-foreground/50">
                        a {m.invoicingName ?? "—"}
                        {m.invoicingCuit ? ` · CUIT ${m.invoicingCuit}` : ""}
                      </span>
                    )}
                  </span>
                )}
                <InvoiceRequestControl
                  key={`${m.needsInvoice}:${m.invoicingName ?? ""}:${m.invoicingCuit ?? ""}`}
                  movementId={m.id}
                  needsInvoice={m.needsInvoice}
                  invoiced={m.invoicedAt != null}
                  invoicingName={m.invoicingName}
                  invoicingCuit={m.invoicingCuit}
                  accountAutoInvoice={m.accountAutoInvoice}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
