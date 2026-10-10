"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/contract";
import { formatDateTime } from "@/lib/datetime";
import { markCashMovementInvoiced, unmarkCashMovementInvoiced } from "@/app/(app)/caja/invoicing-actions";
import type { CashMovementRow } from "@/lib/cash";

/**
 * Un ingreso marcado "Hay que facturar" (ver `needsInvoice`). `resolved`
 * decide si se muestra con el botón "Marcar facturado" (pendiente) o con
 * "Quitar marca" + quién/cuándo lo facturó (ya resuelto) — mismo movimiento,
 * dos estados.
 */
export function PendingInvoiceCard({ movement, resolved }: { movement: CashMovementRow; resolved: boolean }) {
  const [pending, start] = useTransition();

  return (
    <li className="rounded-lg border border-foreground/10 p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 whitespace-pre-wrap">{movement.description}</p>
        <span className="shrink-0 font-semibold text-foreground">{formatMoney(movement.amount, movement.currency)}</span>
      </div>
      <p className="mt-1 text-xs text-foreground/50">
        {movement.invoicingName} · CUIT {movement.invoicingCuit}
        {movement.rentalClientName && (
          <>
            {" · "}
            {movement.rentalId ? (
              <Link href={`/rentals/${movement.rentalId}`} className="underline hover:text-foreground/70">
                {movement.rentalClientName}
              </Link>
            ) : (
              movement.rentalClientName
            )}
          </>
        )}
        {` · Cargado por: ${movement.createdByName} · ${formatDateTime(movement.createdAt)}`}
      </p>
      {resolved ? (
        <>
          <p className="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            Facturado por: {movement.invoicedByName ?? "—"} · {movement.invoicedAt ? formatDateTime(movement.invoicedAt) : "—"}
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => start(() => unmarkCashMovementInvoiced(movement.id))}
            className="mt-2 text-xs text-foreground/40 underline hover:text-foreground/60"
          >
            Se marcó por error — volver a pendiente
          </button>
        </>
      ) : (
        <Button
          type="button"
          variant="secondary"
          disabled={pending}
          className="mt-2 w-full"
          onClick={() => start(() => markCashMovementInvoiced(movement.id))}
        >
          Marcar facturado
        </Button>
      )}
    </li>
  );
}
