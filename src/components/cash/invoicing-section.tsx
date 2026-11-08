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
import {
  incomeMonthKey,
  invoiceLogMonthKey,
  invoicingMonthOptions,
  summarizeInvoicing,
  type InvoicingMonth,
} from "@/lib/invoicing-period";
import { formatDateInput } from "@/lib/datetime";
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
 *
 * Arriba, "Total" (todo el historial) o "Por mes": el mes filtra las
 * tarjetas, la lista y el libro de facturas. Un ingreso cuenta en el mes en
 * que entró, esté pendiente o ya facturado (ver `invoicing-period.ts`).
 */
export function InvoicingSection({ invoicing, invoices }: { invoicing: Invoicing; invoices: InvoiceRow[] }) {
  const [group, setGroup] = useState<InvoiceGroup>("account");
  const [status, setStatus] = useState<StatusFilter>("pending");

  const [month, setMonth] = useState<InvoicingMonth>("all");

  const everything = [...invoicing.pending, ...invoicing.completed];
  const monthOptions = invoicingMonthOptions(
    [...everything.map(incomeMonthKey), ...invoices.map(invoiceLogMonthKey)],
    new Date(),
  );
  const all = month === "all" ? everything : everything.filter((m) => incomeMonthKey(m) === month);
  const monthInvoices = month === "all" ? invoices : invoices.filter((inv) => invoiceLogMonthKey(inv) === month);
  const summary = summarizeInvoicing(all);
  const inGroup = (g: InvoiceGroup) => all.filter((m) => invoiceGroup(m) === g);
  const pendingIn = (g: InvoiceGroup) => all.filter((m) => !m.invoicedAt && invoiceGroup(m) === g);

  const groupItems = inGroup(group);
  const visible = groupItems
    .filter((m) => (status === "pending" ? !m.invoicedAt : status === "invoiced" ? !!m.invoicedAt : true))
    .sort(byNewest);
  const groupPending = pendingIn(group);
  const current = GROUPS.find((g) => g.key === group)!;

  return (
    <div className="flex flex-col gap-5">
      <MonthPicker month={month} options={monthOptions} onChange={setMonth} />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-center">
          <p className="text-xs text-foreground/50">Pendiente de facturar</p>
          <CurrencyTotalsDisplay
            totals={summary.pendingTotal}
            toneClass={summary.pendingCount > 0 ? "text-amber-700 dark:text-amber-400" : ""}
          />
          <p className="text-xs text-foreground/50">{countLabel(summary.pendingCount)}</p>
        </div>
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-center">
          <p className="text-xs text-foreground/50">Total facturado</p>
          <CurrencyTotalsDisplay totals={summary.invoicedTotal} toneClass="text-emerald-700 dark:text-emerald-400" />
          <p className="text-xs text-foreground/50">{countLabel(summary.invoicedCount)}</p>
        </div>
        <div className="col-span-2 rounded-lg border border-foreground/10 p-3 text-center sm:col-span-1">
          <p className="text-xs text-foreground/50">Avance de facturación</p>
          <p className="text-lg font-semibold">
            {summary.progressPercent == null ? "—" : `${summary.progressPercent}%`}
          </p>
          <div
            className="mx-auto mt-1 h-1.5 w-full max-w-40 overflow-hidden rounded-full bg-foreground/10"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={summary.progressPercent ?? 0}
            aria-label="Avance de facturación"
          >
            <div className="h-full bg-emerald-500" style={{ width: `${summary.progressPercent ?? 0}%` }} />
          </div>
          <p className="mt-1 text-xs text-foreground/50">
            {summary.invoicedCount} de {summary.invoicedCount + summary.pendingCount} ingresos facturados
          </p>
        </div>
      </div>

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
            {status === "pending"
              ? month === "all"
                ? "Nada pendiente de facturar acá."
                : "Nada pendiente de facturar acá en este mes."
              : "Sin ingresos para mostrar."}
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
          <SectionTitle>Facturas cargadas ({monthInvoices.length})</SectionTitle>
          <InvoiceLauncher />
        </div>
        <p className="text-xs text-foreground/50">
          Planilla de referencia (monto, fecha, razón social, CUIT) — no está vinculada con los ingresos de arriba.
        </p>
        {monthInvoices.length === 0 ? (
          <p className="rounded-lg border border-foreground/10 px-3 py-2 text-sm text-foreground/50">
            {month === "all" ? "Todavía no se cargó ninguna factura." : "No hay facturas cargadas con fecha de este mes."}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {monthInvoices.map((inv) => (
              <InvoiceLogRow key={inv.id} invoice={inv} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function countLabel(n: number) {
  return n === 1 ? "1 ingreso" : `${n} ingresos`;
}

/**
 * "Total" (todo el historial, la vista de siempre) o "Por mes", con flechas
 * para ir al mes anterior/siguiente entre los que tienen datos.
 */
function MonthPicker({
  month,
  options,
  onChange,
}: {
  month: InvoicingMonth;
  options: { key: string; label: string }[];
  onChange: (m: InvoicingMonth) => void;
}) {
  const currentKey = formatDateInput(new Date()).slice(0, 7);
  const index = options.findIndex((o) => o.key === month);
  const older = index >= 0 ? options[index + 1] : undefined;
  const newer = index > 0 ? options[index - 1] : undefined;

  const pill = (active: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
      active ? "bg-foreground text-background" : "border border-foreground/15 text-foreground/60 hover:border-foreground/30"
    }`;
  const arrow =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-foreground/15 text-foreground/60 disabled:opacity-30";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1.5">
        <button type="button" className={pill(month === "all")} aria-pressed={month === "all"} onClick={() => onChange("all")}>
          Total
        </button>
        <button
          type="button"
          className={pill(month !== "all")}
          aria-pressed={month !== "all"}
          onClick={() => month === "all" && onChange(currentKey)}
        >
          Por mes
        </button>
      </div>
      {month !== "all" && (
        <div className="flex w-full min-w-0 items-center gap-1.5 sm:w-auto">
          <button
            type="button"
            className={arrow}
            disabled={!older}
            onClick={() => older && onChange(older.key)}
            aria-label="Mes anterior"
          >
            ‹
          </button>
          <select
            value={month}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 min-w-0 flex-1 rounded-lg border border-foreground/15 bg-background px-2 text-sm sm:w-52 sm:flex-none"
            aria-label="Mes"
          >
            {options.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={arrow}
            disabled={!newer}
            onClick={() => newer && onChange(newer.key)}
            aria-label="Mes siguiente"
          >
            ›
          </button>
        </div>
      )}
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
