"use client";

import { useState } from "react";
import { filterThisMonth, groupProviderLedgerByMonth } from "@/lib/provider-ledger-grouping";
import { BalanceLine } from "./balance-line";
import { LedgerRow } from "./ledger-row";
import { AssociateIncomeForm } from "./associate-income-form";
import { ProviderPaymentForm } from "./provider-payment-form";
import { DebtMovementForm } from "./debt-movement-form";
import type { AssociateBalance, AssociateLedgerRow } from "@/lib/associates";

const PAGE_SIZE = 10;

type PaymentMethodOption = { id: string; name: string; requiresNote?: boolean };

/**
 * Tarjeta de un asociado: nombre + saldo de cuenta corriente (mismo
 * mecanismo que `ProviderCard`, ver `src/lib/third-party-accounts.ts`),
 * botones para cargar un ingreso/egreso/deuda sin salir de acá, y el
 * historial. Colapsada por defecto (el nombre + saldo van en el `<summary>`,
 * siempre visibles; el resto se revela al abrir) — `defaultOpen` la abre de
 * entrada cuando el filtro de arriba (`AssociatesSection`) la deja como única
 * visible. Adentro, a diferencia de `ProviderCard`, arranca mostrando "Todos
 * los movimientos" (no solo el mes) — al abrir la tarjeta ya es una consulta
 * puntual, mejor no esconder nada por defecto.
 */
export function AssociateCard({
  associate,
  paymentMethods,
  now,
  isAdmin,
  defaultOpen,
}: {
  associate: AssociateBalance & { ledger: AssociateLedgerRow[] };
  paymentMethods: PaymentMethodOption[];
  now: Date;
  isAdmin: boolean;
  defaultOpen: boolean;
}) {
  const [formOpen, setFormOpen] = useState<"none" | "income" | "expense" | "debt">("none");
  const [view, setView] = useState<"month" | "all">("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const thisMonthRows = filterThisMonth(associate.ledger, now);
  const hasMoreHistory = associate.ledger.length > thisMonthRows.length;
  const visibleRows = associate.ledger.slice(0, visibleCount);
  const groups = groupProviderLedgerByMonth(visibleRows, now);
  const cuentaOptions = [{ id: associate.id, name: associate.name }, ...associate.subaccounts];

  return (
    <details className="rounded-xl border border-foreground/10 p-3" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <h3 className="text-sm font-semibold">{associate.name}</h3>
        <BalanceLine balance={associate.balance} />
      </summary>

      {associate.subaccounts.length > 0 && (
        <p className="mt-1 text-xs text-foreground/50">
          Incluye {associate.subaccounts.length === 1 ? "su subcuenta" : "sus subcuentas"}:{" "}
          {associate.subaccounts.map((s) => s.name).join(", ")}.
        </p>
      )}

      {formOpen === "none" && (
        <div className="mt-2 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setFormOpen("income")}
            className="rounded-lg border border-foreground/15 px-2 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:bg-foreground/5"
          >
            + Ingreso
          </button>
          <button
            type="button"
            onClick={() => setFormOpen("expense")}
            className="rounded-lg border border-foreground/15 px-2 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:bg-foreground/5"
          >
            + Egreso
          </button>
          <button
            type="button"
            onClick={() => setFormOpen("debt")}
            className="rounded-lg border border-foreground/15 px-2 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:bg-foreground/5"
          >
            + Deuda
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
      {formOpen === "debt" && (
        <div className="mt-2">
          <DebtMovementForm
            onCancel={() => setFormOpen("none")}
            onSuccess={() => setFormOpen("none")}
            account={associate}
          />
        </div>
      )}

      {view === "month" ? (
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground/50">Este mes</h4>
            <button
              type="button"
              onClick={() => setView("all")}
              className="text-xs font-medium text-foreground/60 underline hover:text-foreground/80"
            >
              Ver todos los movimientos ({associate.ledger.length})
            </button>
          </div>
          {thisMonthRows.length === 0 ? (
            <p className="text-xs text-foreground/50">Sin movimientos este mes.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {thisMonthRows.map((m) => (
                <LedgerRow
                  key={`${m.id}:${m.description}:${m.amount}:${m.currency}`}
                  movement={m}
                  isAdmin={isAdmin}
                  principalName={associate.name}
                />
              ))}
            </ul>
          )}
          {!hasMoreHistory && thisMonthRows.length > 0 && (
            <p className="text-xs text-foreground/40">Es todo el historial — no hay movimientos de otros meses.</p>
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
                    <LedgerRow
                      key={`${m.id}:${m.description}:${m.amount}:${m.currency}`}
                      movement={m}
                      isAdmin={isAdmin}
                      principalName={associate.name}
                    />
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
    </details>
  );
}
