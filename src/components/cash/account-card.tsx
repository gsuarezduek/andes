"use client";

import { useState } from "react";
import type { PaymentMethodOwnership } from "@prisma/client";
import { filterThisMonth, groupProviderLedgerByMonth } from "@/lib/provider-ledger-grouping";
import { CurrencyTotalsDisplay } from "./currency-totals-display";
import { MovementRow } from "./movement-row";
import type { OwnAccountBalance, CashMovementRow } from "@/lib/cash";

const PAGE_SIZE = 10;

type PaymentMethodOption = { id: string; name: string; requiresNote?: boolean; ownership: PaymentMethodOwnership };
type ExpenseCategoryOption = { id: string; name: string };

/**
 * Tarjeta de una cuenta propia (Efectivo, banco, Mercado Pago, etc.): nombre
 * + saldo actual (histórico completo, ver `getOwnAccountBalances`) + su
 * historial de movimientos, colapsado por defecto — mismo mecanismo que
 * `ProviderCard` (mes en curso primero, "Ver todos los movimientos" agrupa
 * por mes con "Cargar más"). A diferencia de esa tarjeta, acá no hay botones
 * de "+ Pago/+ Deuda" — cargar un movimiento de una cuenta propia sigue
 * siendo el "+ Ingreso/+ Egreso" de la pestaña Movimientos; esto es solo
 * lectura del saldo y el historial. Solo se usa en la pestaña "Cuentas
 * propias" (admin), así que reusa `MovementRow` (editable) directamente, sin
 * una variante de solo lectura.
 */
export function AccountCard({
  account,
  paymentMethods,
  expenseCategories,
  now,
}: {
  account: OwnAccountBalance & { ledger: CashMovementRow[] };
  paymentMethods: PaymentMethodOption[];
  expenseCategories: ExpenseCategoryOption[];
  now: Date;
}) {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [view, setView] = useState<"month" | "all">("month");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const thisMonthRows = filterThisMonth(account.ledger, now);
  const hasMoreHistory = account.ledger.length > thisMonthRows.length;
  const visibleRows = account.ledger.slice(0, visibleCount);
  const groups = groupProviderLedgerByMonth(visibleRows, now);

  return (
    <section className="rounded-xl border border-foreground/10 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{account.name}</h3>
          {account.subaccounts.length > 0 && (
            <p className="text-xs text-foreground/50">
              Incluye {account.subaccounts.map((s) => s.name).join(", ")}
            </p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <CurrencyTotalsDisplay totals={account.balance} size="text-base" />
        </div>
      </div>

      {!historyOpen ? (
        <button
          type="button"
          onClick={() => setHistoryOpen(true)}
          className="mt-3 block text-xs font-medium text-foreground/60 underline hover:text-foreground/80"
        >
          Ver movimientos ({account.ledger.length})
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
                    <MovementRow
                      key={`${m.id}:${m.description}:${m.amount}:${m.currency}:${m.categoryName ?? ""}`}
                      movement={m}
                      tone={m.type === "income" ? "emerald" : "red"}
                      paymentMethods={paymentMethods}
                      expenseCategories={expenseCategories}
                    />
                  ))}
                </ul>
              )}
              {hasMoreHistory && (
                <button
                  type="button"
                  onClick={() => setView("all")}
                  className="self-start text-xs font-medium text-foreground/60 underline hover:text-foreground/80"
                >
                  Ver todos los movimientos ({account.ledger.length})
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
                        <MovementRow
                          key={`${m.id}:${m.description}:${m.amount}:${m.currency}:${m.categoryName ?? ""}`}
                          movement={m}
                          tone={m.type === "income" ? "emerald" : "red"}
                          paymentMethods={paymentMethods}
                          expenseCategories={expenseCategories}
                        />
                      ))}
                    </ul>
                  </div>
                ))
              )}
              {visibleCount < account.ledger.length && (
                <button
                  type="button"
                  onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                  className="self-center rounded-lg border border-foreground/15 px-3 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:bg-foreground/5"
                >
                  Cargar más ({account.ledger.length - visibleCount} restantes)
                </button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
