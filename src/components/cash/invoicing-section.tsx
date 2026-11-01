"use client";

import { useState, useTransition } from "react";
import { SectionTitle } from "@/components/ui/section-title";
import { Button } from "@/components/ui/button";
import { PendingInvoiceCard } from "./pending-invoice-card";
import { InvoiceLauncher } from "./invoice-launcher";
import { CurrencyTotalsDisplay } from "./currency-totals-display";
import { formatMoney } from "@/lib/contract";
import { formatDate } from "@/lib/datetime";
import { sumByCurrency } from "@/lib/currency";
import { invoiceGroup, type InvoiceGroup } from "@/lib/invoicing-rules";
import { deleteInvoice } from "@/app/(app)/caja/invoicing-actions";
import type { CashMovementRow, Invoicing } from "@/lib/cash";
import type { InvoiceRow } from "@/lib/invoices";

type StatusFilter = "pending" | "invoiced" | "all";

const GROUPS: { key: InvoiceGroup; label: string; hint: string }[] = [
  {
    key: "account",
    label: "Por medio de pago",
    hint: "Lo que entró a cuentas que facturan solas (Mercado Pago, tarjetas, BBVA…) o se mandó a facturación a mano sin datos del cliente.",
  },
  {
    key: "client",
    label: "Pedidos de clientes",
    hint: "El cliente pidió factura y dio sus datos: se le factura a él.",
  },
];

const STATUS_LABELS: Record<StatusFilter, string> = { pending: "Pendientes", invoiced: "Facturados", all: "Todos" };

/**
 * Caja → Facturación: ingresos que hay que facturar, en dos grupos — los que
 * entraron a una cuenta que factura sola (`PaymentMethod.autoInvoice`) y los
 * pedidos de clientes (con nombre/CUIT). Es un solo ítem por ingreso: si
 * entró por Mercado Pago y además el cliente pidió factura a su nombre, va a
 * "Pedidos de clientes". Abajo, el libro de facturas cargadas — un registro
 * suelto, sin vínculo formal con los ingresos (ver modelo `Invoice`).
 */
export function InvoicingSection({ invoicing, invoices }: { invoicing: Invoicing; invoices: InvoiceRow[] }) {
  const [group, setGroup] = useState<InvoiceGroup>("account");
  const [status, setStatus] = useState<StatusFilter>("pending");

  const all = [...invoicing.pending, ...invoicing.completed];
  const inGroup = (g: InvoiceGroup) => all.filter((m) => invoiceGroup(m) === g);
  const pendingIn = (g: InvoiceGroup) => invoicing.pending.filter((m) => invoiceGroup(m) === g);

  const groupItems = inGroup(group);
  const visible = groupItems
    .filter((m) => (status === "pending" ? !m.invoicedAt : status === "invoiced" ? !!m.invoicedAt : true))
    .sort(byNewest);
  const groupPending = pendingIn(group);
  const current = GROUPS.find((g) => g.key === group)!;

  return (
    <div className="flex flex-col gap-5">
      {invoicing.pending.length > 0 && (
        <div className="rounded-lg border border-foreground/10 p-3 text-center">
          <p className="text-xs text-foreground/50">Pendiente de facturar (todo)</p>
          <CurrencyTotalsDisplay totals={invoicing.pendingTotal} />
        </div>
      )}

      <div className="grid grid-cols-2 gap-1.5">
        {GROUPS.map((g) => {
          const count = pendingIn(g.key).length;
          return (
            <button
              key={g.key}
              type="button"
              onClick={() => setGroup(g.key)}
              aria-pressed={group === g.key}
              className={`rounded-lg px-2 py-2 text-sm font-medium transition-colors ${
                group === g.key
                  ? "bg-foreground text-background"
                  : "border border-foreground/15 text-foreground/60 hover:border-foreground/30"
              }`}
            >
              {g.label}
              {count > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-500/15 px-1.5 text-xs text-amber-700 dark:text-amber-400">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <section className="flex flex-col gap-2">
        <p className="text-xs text-foreground/50">{current.hint}</p>
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setStatus(k)}
              className={`rounded-full border px-3 py-1 text-xs ${
                status === k ? "border-foreground/40 bg-foreground/10 font-medium" : "border-foreground/10 text-foreground/60"
              }`}
            >
              {STATUS_LABELS[k]} ({countFor(groupItems, k)})
            </button>
          ))}
          {groupPending.length > 0 && (
            <span className="ml-auto text-xs text-foreground/50">
              Pendiente: <CurrencyTotalsInline items={groupPending} />
            </span>
          )}
        </div>
        {visible.length === 0 ? (
          <p className="rounded-lg border border-foreground/10 px-3 py-2 text-sm text-foreground/50">
            {status === "pending" ? "Nada pendiente de facturar acá." : "Sin ingresos para mostrar."}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {visible.map((m) => (
              <PendingInvoiceCard
                key={`${m.id}:${m.invoicedAt ? "1" : "0"}:${m.invoicingName ?? ""}:${m.invoicingCuit ?? ""}`}
                movement={m}
              />
            ))}
          </ul>
        )}
        <p className="text-xs text-foreground/50">
          Para mandar un ingreso a facturación a mano (ej. una reserva ya entregada), abrilo desde Movimientos o
          desde la pestaña Pagos de la reserva.
        </p>
      </section>

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

function byNewest(a: CashMovementRow, b: CashMovementRow) {
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

function countFor(items: CashMovementRow[], status: StatusFilter) {
  if (status === "all") return items.length;
  return items.filter((m) => (status === "pending" ? !m.invoicedAt : !!m.invoicedAt)).length;
}

function CurrencyTotalsInline({ items }: { items: CashMovementRow[] }) {
  const totals = sumByCurrency(items);
  const parts = (Object.entries(totals) as [keyof typeof totals, number][])
    .filter(([, v]) => v !== 0)
    .map(([c, v]) => formatMoney(v, c));
  return <span className="font-medium text-foreground">{parts.join(" · ") || formatMoney(0, "ars")}</span>;
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
