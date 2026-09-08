"use client";

import { useState } from "react";
import { filterThisMonth, groupProviderLedgerByMonth } from "@/lib/provider-ledger-grouping";
import { BalanceLine } from "./balance-line";
import { LedgerRow } from "./ledger-row";
import { DebtMovementForm } from "./debt-movement-form";
import { ProviderPaymentForm } from "./provider-payment-form";
import type { ProviderBalance, ProviderLedgerRow } from "@/lib/providers";

const PAGE_SIZE = 10;

type PaymentMethodOption = { id: string; name: string; requiresNote?: boolean };

/**
 * Tarjeta de un proveedor (cuenta corriente): nombre + saldo, botones para
 * cargar un pago o una deuda sin salir de acá (Destino/Proveedor ya vienen
 * fijos) — siempre visibles. El historial de movimientos arranca
 * **colapsado**: por defecto se ve solo el resumen (saldo + acciones), sin
 * la lista de movimientos, para no saturar la pantalla con varios
 * proveedores; "Ver movimientos" lo despliega (mes en curso primero, "Ver
 * todos los movimientos" cambia a la lista completa agrupada por mes,
 * revelada de a `PAGE_SIZE` con "Cargar más" — todo client-side: `ledger` ya
 * viene completo desde el server) y "Ocultar movimientos" vuelve a colapsar.
 */
export function ProviderCard({
  provider,
  paymentMethods,
  now,
  isAdmin,
}: {
  provider: ProviderBalance & { ledger: ProviderLedgerRow[] };
  paymentMethods: PaymentMethodOption[];
  now: Date;
  isAdmin: boolean;
}) {
  const [formOpen, setFormOpen] = useState<"none" | "payment" | "debt">("none");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [view, setView] = useState<"month" | "all">("month");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const thisMonthRows = filterThisMonth(provider.ledger, now);
  const hasMoreHistory = provider.ledger.length > thisMonthRows.length;
  const visibleRows = provider.ledger.slice(0, visibleCount);
  const groups = groupProviderLedgerByMonth(visibleRows, now);

  return (
    <section className="rounded-xl border border-foreground/10 p-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{provider.name}</h3>
        <BalanceLine balance={provider.balance} />
      </div>

      {formOpen === "none" && (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => setFormOpen("payment")}
            className="flex-1 rounded-lg border border-foreground/15 px-2 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:bg-foreground/5"
          >
            + Pago
          </button>
          <button
            type="button"
            onClick={() => setFormOpen("debt")}
            className="flex-1 rounded-lg border border-foreground/15 px-2 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:bg-foreground/5"
          >
            + Deuda
          </button>
        </div>
      )}
      {formOpen === "payment" && (
        <div className="mt-2">
          <ProviderPaymentForm
            onCancel={() => setFormOpen("none")}
            onSuccess={() => setFormOpen("none")}
            account={provider}
            destinoOptions={[{ id: provider.id, name: provider.name }, ...provider.subaccounts]}
            paymentMethods={paymentMethods}
          />
        </div>
      )}
      {formOpen === "debt" && (
        <div className="mt-2">
          <DebtMovementForm
            onCancel={() => setFormOpen("none")}
            onSuccess={() => setFormOpen("none")}
            account={provider}
          />
        </div>
      )}

      {!historyOpen ? (
        <button
          type="button"
          onClick={() => setHistoryOpen(true)}
          className="mt-3 block text-xs font-medium text-foreground/60 underline hover:text-foreground/80"
        >
          Ver movimientos ({provider.ledger.length})
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={() => {
              setHistoryOpen(false);
              setView("month");
              setVisibleCount(PAGE_SIZE);
            }}
            className="mt-3 block text-xs font-medium text-foreground/60 underline hover:text-foreground/80"
          >
            Ocultar movimientos
          </button>
          {view === "month" ? (
            <div className="mt-2 flex flex-col gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground/50">Este mes</h4>
              {thisMonthRows.length === 0 ? (
                <p className="text-xs text-foreground/50">Sin movimientos este mes.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {thisMonthRows.map((m) => (
                    <LedgerRow key={`${m.id}:${m.description}:${m.amount}:${m.currency}`} movement={m} isAdmin={isAdmin} principalName={provider.name} />
                  ))}
                </ul>
              )}
              {hasMoreHistory && (
                <button
                  type="button"
                  onClick={() => setView("all")}
                  className="self-start text-xs font-medium text-foreground/60 underline hover:text-foreground/80"
                >
                  Ver todos los movimientos ({provider.ledger.length})
                </button>
              )}
            </div>
          ) : (
            <div className="mt-2 flex flex-col gap-3">
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
                        <LedgerRow key={`${m.id}:${m.description}:${m.amount}:${m.currency}`} movement={m} isAdmin={isAdmin} principalName={provider.name} />
                      ))}
                    </ul>
                  </div>
                ))
              )}
              {visibleCount < provider.ledger.length && (
                <button
                  type="button"
                  onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                  className="self-center rounded-lg border border-foreground/15 px-3 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:bg-foreground/5"
                >
                  Cargar más ({provider.ledger.length - visibleCount} restantes)
                </button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
