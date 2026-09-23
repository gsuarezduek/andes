"use client";

import { useState } from "react";
import type { PaymentMethodOwnership } from "@prisma/client";
import { SectionTitle } from "@/components/ui/section-title";
import { MovementRow } from "./movement-row";
import { CurrencyTotalsDisplay } from "./currency-totals-display";
import { sumByCurrency } from "@/lib/currency";
import type { CashMovementRow } from "@/lib/cash";
import type { ProviderLedgerMonthGroup } from "@/lib/provider-ledger-grouping";

const PAGE_SIZE_MONTHS = 6;

type PaymentMethodOption = { id: string; name: string; requiresNote?: boolean; ownership: PaymentMethodOwnership };
type ExpenseCategoryOption = { id: string; name: string };

/**
 * Historial de una cuenta propia (`/caja/saldos/[id]`), partido por mes
 * calendario: cada mes muestra su balance (ingresos − egresos de ese mes) y,
 * debajo, sus movimientos en dos columnas — ingresos a la izquierda, egresos
 * a la derecha, mismo criterio visual que Movimientos (ver
 * `CashMovementsBoard`) — antes de pasar al mes siguiente. Los meses más
 * viejos quedan detrás de "Ver meses anteriores" (igual patrón que "Cargar
 * más" en `ProviderCard`/`AccountCard`, a nivel mes en vez de fila).
 */
export function AccountLedgerMonths({
  groups,
  paymentMethods,
  expenseCategories,
}: {
  groups: ProviderLedgerMonthGroup<CashMovementRow>[];
  paymentMethods: PaymentMethodOption[];
  expenseCategories: ExpenseCategoryOption[];
}) {
  const [visibleMonths, setVisibleMonths] = useState(PAGE_SIZE_MONTHS);

  if (groups.length === 0) {
    return (
      <p className="rounded-lg border border-foreground/10 px-3 py-2 text-sm text-foreground/50">
        Sin movimientos todavía.
      </p>
    );
  }

  const visible = groups.slice(0, visibleMonths);

  return (
    <div className="flex flex-col gap-6">
      {visible.map((g) => {
        const incomes = g.rows.filter((r) => r.type === "income");
        const expenses = g.rows.filter((r) => r.type === "expense");
        const incomeTotals = sumByCurrency(incomes);
        const expenseTotals = sumByCurrency(expenses);
        const net = { ars: incomeTotals.ars - expenseTotals.ars, usd: incomeTotals.usd - expenseTotals.usd };
        return (
          <section key={g.key} className="flex flex-col gap-3 rounded-xl border border-foreground/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold">{g.label}</h3>
              <div className="text-right">
                <p className="text-xs text-foreground/50">Balance del mes</p>
                <CurrencyTotalsDisplay totals={net} size="text-base" />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <SectionTitle>Ingresos ({incomes.length})</SectionTitle>
                {incomes.length === 0 ? (
                  <p className="rounded-lg border border-foreground/10 px-3 py-2 text-sm text-foreground/50">
                    Sin ingresos este mes.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {incomes.map((r) => (
                      <MovementRow
                        key={`${r.id}:${r.description}:${r.amount}:${r.currency}:${r.paymentMethodName}`}
                        movement={r}
                        tone="emerald"
                        paymentMethods={paymentMethods}
                        expenseCategories={expenseCategories}
                      />
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <SectionTitle>Egresos ({expenses.length})</SectionTitle>
                {expenses.length === 0 ? (
                  <p className="rounded-lg border border-foreground/10 px-3 py-2 text-sm text-foreground/50">
                    Sin egresos este mes.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {expenses.map((r) => (
                      <MovementRow
                        key={`${r.id}:${r.description}:${r.amount}:${r.currency}:${r.paymentMethodName}:${r.recipientPaymentMethodName ?? ""}:${r.categoryName ?? ""}`}
                        movement={r}
                        tone="red"
                        paymentMethods={paymentMethods}
                        expenseCategories={expenseCategories}
                      />
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        );
      })}
      {visibleMonths < groups.length && (
        <button
          type="button"
          onClick={() => setVisibleMonths((n) => n + PAGE_SIZE_MONTHS)}
          className="self-center rounded-lg border border-foreground/15 px-3 py-1.5 text-xs font-medium text-foreground/70 transition-colors hover:bg-foreground/5"
        >
          Ver meses anteriores ({groups.length - visibleMonths} restantes)
        </button>
      )}
    </div>
  );
}
