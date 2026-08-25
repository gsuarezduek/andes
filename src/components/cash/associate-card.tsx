"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/contract";
import { formatDateTime } from "@/lib/datetime";
import { CURRENCIES } from "@/lib/currency";
import { filterThisMonth, groupProviderLedgerByMonth } from "@/lib/provider-ledger-grouping";
import { AssociateIncomeForm } from "./associate-income-form";
import { ProviderPaymentForm } from "./provider-payment-form";
import type { AssociateBalance, AssociateLedgerRow } from "@/lib/associates";

const PAGE_SIZE = 10;

type PaymentMethodOption = { id: string; name: string; requiresNote?: boolean };

/** Total entregado por moneda — nada si está en cero en todas. */
function DeliveredLine({ delivered }: { delivered: AssociateBalance["delivered"] }) {
  const entries = CURRENCIES.filter((c) => delivered[c] !== 0);
  if (entries.length === 0) {
    return <span className="text-sm text-foreground/50">Sin movimientos</span>;
  }
  return (
    <span className="flex flex-col items-end gap-0.5 text-sm font-semibold">
      {entries.map((c) => (
        <span key={c} className="text-emerald-600">
          {formatMoney(delivered[c], c)}
        </span>
      ))}
    </span>
  );
}

function LedgerRow({ movement, principalName }: { movement: AssociateLedgerRow; principalName: string }) {
  // Si la cuenta real usada es una subcuenta (no la principal), lo aclara —
  // la vista sigue unificada, pero no se pierde por dónde salió/entró la plata.
  const viaSubaccount = movement.accountName && movement.accountName !== principalName;
  const isIncome = movement.kind === "income";
  return (
    <li className="rounded-lg border border-foreground/10 px-3 py-2 text-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 whitespace-pre-wrap">{movement.description}</p>
        <p className={`shrink-0 font-semibold ${isIncome ? "text-emerald-600" : "text-red-600"}`}>
          {isIncome ? "+" : "−"}
          {formatMoney(movement.amount, movement.currency)}
        </p>
      </div>
      <p className="mt-1 text-xs text-foreground/50">
        {isIncome ? "Pago directo del cliente" : "Pagado por la empresa"} · {movement.createdByName} ·{" "}
        {formatDateTime(movement.createdAt)}
        {viaSubaccount && ` · vía ${movement.accountName}`}
      </p>
    </li>
  );
}

/**
 * Tarjeta de un asociado: nombre + total entregado, botones para cargar un
 * ingreso o un egreso sin salir de acá (Cuenta/Destino ya vienen fijos), y el
 * historial — mismo patrón que `ProviderCard` pero sin cuenta corriente (un
 * asociado no tiene deuda, es solo la foto de cuánto entró/salió por su
 * cuenta).
 */
export function AssociateCard({
  associate,
  paymentMethods,
  now,
}: {
  associate: AssociateBalance & { ledger: AssociateLedgerRow[] };
  paymentMethods: PaymentMethodOption[];
  now: Date;
}) {
  const [formOpen, setFormOpen] = useState<"none" | "income" | "expense">("none");
  const [view, setView] = useState<"month" | "all">("month");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const thisMonthRows = filterThisMonth(associate.ledger, now);
  const hasMoreHistory = associate.ledger.length > thisMonthRows.length;
  const visibleRows = associate.ledger.slice(0, visibleCount);
  const groups = groupProviderLedgerByMonth(visibleRows, now);
  const cuentaOptions = [{ id: associate.id, name: associate.name }, ...associate.subaccounts];

  return (
    <section className="rounded-xl border border-foreground/10 p-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{associate.name}</h3>
        <DeliveredLine delivered={associate.delivered} />
      </div>

      {formOpen === "none" && (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => setFormOpen("income")}
            className="flex-1 rounded-lg border border-foreground/15 px-2 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:bg-foreground/5"
          >
            + Ingreso
          </button>
          <button
            type="button"
            onClick={() => setFormOpen("expense")}
            className="flex-1 rounded-lg border border-foreground/15 px-2 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:bg-foreground/5"
          >
            + Egreso
          </button>
        </div>
      )}
      {formOpen === "income" && (
        <div className="mt-2">
          <AssociateIncomeForm
            onCancel={() => setFormOpen("none")}
            onSuccess={() => setFormOpen("none")}
            account={associate}
            cuentaOptions={cuentaOptions}
          />
        </div>
      )}
      {formOpen === "expense" && (
        <div className="mt-2">
          <ProviderPaymentForm
            onCancel={() => setFormOpen("none")}
            onSuccess={() => setFormOpen("none")}
            account={associate}
            destinoOptions={cuentaOptions}
            paymentMethods={paymentMethods}
          />
        </div>
      )}

      {view === "month" ? (
        <div className="mt-3 flex flex-col gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground/50">Este mes</h4>
          {thisMonthRows.length === 0 ? (
            <p className="text-xs text-foreground/50">Sin movimientos este mes.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {thisMonthRows.map((m) => (
                <LedgerRow key={`${m.id}:${m.description}:${m.amount}:${m.currency}`} movement={m} principalName={associate.name} />
              ))}
            </ul>
          )}
          {hasMoreHistory && (
            <button
              type="button"
              onClick={() => setView("all")}
              className="self-start text-xs font-medium text-foreground/60 underline hover:text-foreground/80"
            >
              Ver todos los movimientos ({associate.ledger.length})
            </button>
          )}
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground/50">
              Todos los movimientos
            </h4>
            <button
              type="button"
              onClick={() => {
                setView("month");
                setVisibleCount(PAGE_SIZE);
              }}
              className="text-xs font-medium text-foreground/60 underline hover:text-foreground/80"
            >
              Ver solo este mes
            </button>
          </div>
          {groups.length === 0 ? (
            <p className="text-xs text-foreground/50">Sin movimientos todavía.</p>
          ) : (
            groups.map((g) => (
              <div key={g.key} className="flex flex-col gap-2">
                <h5 className="text-xs font-medium text-foreground/50">{g.label}</h5>
                <ul className="flex flex-col gap-2">
                  {g.rows.map((m) => (
                    <LedgerRow key={`${m.id}:${m.description}:${m.amount}:${m.currency}`} movement={m} principalName={associate.name} />
                  ))}
                </ul>
              </div>
            ))
          )}
          {visibleCount < associate.ledger.length && (
            <button
              type="button"
              onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
              className="self-center rounded-lg border border-foreground/15 px-3 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:bg-foreground/5"
            >
              Cargar más ({associate.ledger.length - visibleCount} restantes)
            </button>
          )}
        </div>
      )}
    </section>
  );
}
