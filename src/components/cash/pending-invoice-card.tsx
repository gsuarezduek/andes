"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InvoiceRequestControl } from "./invoice-request-control";
import { formatMoney } from "@/lib/contract";
import { formatDateTime } from "@/lib/datetime";
import { markCashMovementInvoiced, unmarkCashMovementInvoiced } from "@/app/(app)/caja/invoicing-actions";
import type { CashMovementRow } from "@/lib/cash";

/**
 * Un ingreso en Caja → Facturación (ver `needsInvoice`): monto, estado,
 * reserva, cuenta a la que ingresó, fecha y, si el cliente pidió factura, sus
 * datos. Mismo movimiento en sus dos estados: pendiente ("Marcar facturado")
 * o facturado (quién/cuándo + "volver a pendiente").
 */
export function PendingInvoiceCard({ movement }: { movement: CashMovementRow }) {
  const [pending, start] = useTransition();
  const invoiced = movement.invoicedAt != null;
  const hasClientData = !!(movement.invoicingName || movement.invoicingCuit);

  return (
    <li className="flex flex-col gap-2 rounded-lg border border-foreground/10 p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 whitespace-pre-wrap">{movement.description}</p>
        <span className="shrink-0 font-semibold text-foreground">{formatMoney(movement.amount, movement.currency)}</span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {invoiced ? <Badge tone="emerald">Facturado</Badge> : <Badge tone="amber">Pendiente</Badge>}
        {movement.invoiceAuto && <Badge tone="blue">Automático</Badge>}
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
        <dt className="text-foreground/50">Reserva</dt>
        <dd className="min-w-0 truncate">
          <BookingLink movement={movement} />
        </dd>
        <dt className="text-foreground/50">Ingresó a</dt>
        <dd className="min-w-0 truncate">
          {movement.paymentMethodName}
          {movement.paymentMethodNote ? ` (${movement.paymentMethodNote})` : ""}
        </dd>
        <dt className="text-foreground/50">Fecha</dt>
        <dd>{formatDateTime(movement.createdAt)}</dd>
        {hasClientData && (
          <>
            <dt className="text-foreground/50">Facturar a</dt>
            <dd className="min-w-0">
              {movement.invoicingName ?? "—"}
              {movement.invoicingCuit ? ` · CUIT ${movement.invoicingCuit}` : ""}
            </dd>
          </>
        )}
        {invoiced && (
          <>
            <dt className="text-foreground/50">Facturado por</dt>
            <dd className="font-medium text-emerald-700 dark:text-emerald-400">
              {movement.invoicedByName ?? "—"} · {movement.invoicedAt ? formatDateTime(movement.invoicedAt) : "—"}
            </dd>
          </>
        )}
      </dl>

      {invoiced ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => unmarkCashMovementInvoiced(movement.id))}
          className="self-start text-xs text-foreground/40 underline hover:text-foreground/60"
        >
          Se marcó por error — volver a pendiente
        </button>
      ) : (
        <>
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            className="w-full"
            onClick={() => start(() => markCashMovementInvoiced(movement.id))}
          >
            Marcar facturado
          </Button>
          <InvoiceRequestControl
            movementId={movement.id}
            needsInvoice
            invoiced={false}
            invoicingName={movement.invoicingName}
            invoicingCuit={movement.invoicingCuit}
            accountAutoInvoice={movement.accountAutoInvoice}
          />
        </>
      )}
    </li>
  );
}

function BookingLink({ movement }: { movement: CashMovementRow }) {
  if (movement.rentalId && movement.rentalClientName) {
    return (
      <Link href={`/rentals/${movement.rentalId}`} className="underline hover:text-foreground/70">
        {movement.rentalClientName}
        {movement.rentalBookingId ? ` · #${movement.rentalBookingId}` : ""}
      </Link>
    );
  }
  if (movement.roomBookingId && movement.roomId && movement.roomBookingLabel) {
    return (
      <Link
        href={`/rooms/${movement.roomId}/bookings/${movement.roomBookingId}`}
        className="underline hover:text-foreground/70"
      >
        {movement.roomBookingLabel}
      </Link>
    );
  }
  return <span className="text-foreground/50">Sin reserva</span>;
}
