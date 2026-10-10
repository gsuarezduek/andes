"use client";

import { useState, useTransition } from "react";
import { SectionTitle } from "@/components/ui/section-title";
import { Button } from "@/components/ui/button";
import { PendingInvoiceCard } from "./pending-invoice-card";
import { InvoiceLauncher } from "./invoice-launcher";
import { CurrencyTotalsDisplay } from "./currency-totals-display";
import { formatMoney } from "@/lib/contract";
import { formatDate } from "@/lib/datetime";
import { deleteInvoice } from "@/app/(app)/caja/invoicing-actions";
import type { Invoicing } from "@/lib/cash";
import type { InvoiceRow } from "@/lib/invoices";

/**
 * Caja → Facturación: ingresos marcados "Hay que facturar" (checkbox en
 * +Ingreso, "Agregar pago" o el wizard de entrega/devolución), separados
 * entre Pendientes y Realizados, más el libro de facturas cargadas — un
 * registro suelto, sin vínculo formal con los ingresos de arriba (ver
 * comentario del modelo `Invoice` en el schema).
 */
export function InvoicingSection({ invoicing, invoices }: { invoicing: Invoicing; invoices: InvoiceRow[] }) {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-xs text-foreground/50">
        Se cargan marcando &quot;Hay que facturar&quot; al anotar un ingreso — desde Movimientos → +Ingreso, el botón
        &quot;Agregar pago&quot; de una reserva, o el paso de pagos de la entrega/devolución.
      </p>

      {invoicing.pending.length > 0 && (
        <div className="rounded-lg border border-foreground/10 p-3 text-center">
          <p className="text-xs text-foreground/50">Pendiente de facturar</p>
          <CurrencyTotalsDisplay totals={invoicing.pendingTotal} />
        </div>
      )}

      <section className="flex flex-col gap-2">
        <SectionTitle>Pendientes ({invoicing.pending.length})</SectionTitle>
        {invoicing.pending.length === 0 ? (
          <p className="rounded-lg border border-foreground/10 px-3 py-2 text-sm text-foreground/50">
            Sin ingresos pendientes de facturar.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {invoicing.pending.map((m) => (
              <PendingInvoiceCard key={m.id} movement={m} resolved={false} />
            ))}
          </ul>
        )}
      </section>

      {invoicing.completed.length > 0 && (
        <details>
          <summary className="cursor-pointer text-xs font-medium text-foreground/60">
            Realizados ({invoicing.completed.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-2">
            {invoicing.completed.map((m) => (
              <PendingInvoiceCard key={m.id} movement={m} resolved />
            ))}
          </ul>
        </details>
      )}

      <section className="flex flex-col gap-2 border-t border-foreground/10 pt-4">
        <div className="flex items-center justify-between">
          <SectionTitle>Facturas cargadas ({invoices.length})</SectionTitle>
          <InvoiceLauncher />
        </div>
        <p className="text-xs text-foreground/50">
          Planilla de referencia (monto, fecha, razón social, CUIT) — no está vinculada con los ingresos de arriba.
        </p>
        {invoices.length === 0 ? (
          <p className="rounded-lg border border-foreground/10 px-3 py-2 text-sm text-foreground/50">
            Todavía no se cargó ninguna factura.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {invoices.map((inv) => (
              <InvoiceLogRow key={inv.id} invoice={inv} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function InvoiceLogRow({ invoice }: { invoice: InvoiceRow }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  return (
    <li className="rounded-lg border border-foreground/10 p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{invoice.razonSocial}</p>
          <p className="truncate text-xs text-foreground/50">
            CUIT {invoice.cuit} · {formatDate(invoice.date)}
          </p>
        </div>
        <span className="shrink-0 font-semibold text-foreground">
          {formatMoney(invoice.amount, invoice.currency)}
        </span>
      </div>
      <p className="mt-1 text-xs text-foreground/50">Cargada por: {invoice.createdByName}</p>
      {confirming ? (
        <div className="mt-2 flex items-center gap-3">
          <span className="text-xs text-red-600">¿Eliminar esta factura?</span>
          <button type="button" onClick={() => setConfirming(false)} className="text-xs text-foreground/50">
            Cancelar
          </button>
          <Button
            type="button"
            variant="danger"
            disabled={pending}
            className="ml-auto h-auto px-2.5 py-1 text-xs"
            onClick={() => start(() => deleteInvoice(invoice.id))}
          >
            Sí, eliminar
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="mt-2 text-xs text-foreground/40 underline hover:text-foreground/60"
        >
          Se cargó por error — eliminar
        </button>
      )}
    </li>
  );
}
