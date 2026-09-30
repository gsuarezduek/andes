"use client";

import { useState } from "react";
import type { PaymentMethodOwnership } from "@prisma/client";
import { SectionTitle } from "@/components/ui/section-title";
import { MovementRow } from "./movement-row";
import { CurrencyTotalsDisplay } from "./currency-totals-display";
import { sumByCurrency, type CurrencyTotals } from "@/lib/currency";
import { fundBalanceAtMonthEnd } from "@/lib/investment-funds";
import type { CashMovementRow } from "@/lib/cash";
import type { ProviderLedgerMonthGroup } from "@/lib/provider-ledger-grouping";
import type { FundMovementRow } from "@/lib/investment-funds-queries";

const PAGE_SIZE_MONTHS = 6;

type PaymentMethodOption = { id: string; name: string; requiresNote?: boolean; ownership: PaymentMethodOwnership };
type ExpenseCategoryOption = { id: string; name: string };

/** Ingresos/Egresos/En Fondos, apilados y alineados a la derecha — una columna del resumen mensual. */
function MiniStat({ label, totals }: { label: string; totals: CurrencyTotals }) {
  return (
    <div>
      <p className="text-[11px] text-foreground/50">{label}</p>
      <CurrencyTotalsDisplay totals={totals} size="text-sm" />
    </div>
  );
}

/**
 * Historial de una cuenta propia (`/caja/saldos/[id]`), partido por mes
 * calendario: cada mes es un `<details>` colapsable — el mes actual abierto
 * de entrada, el resto colapsados (pedido del dueño); colapsado solo se ve
 * el nombre del mes + su balance (el `<summary>`), que es lo mismo que
 * muestra abierto, así no hay nada que "aparezca" al expandir salvo el
 * detalle. Adentro, sus movimientos en dos columnas — ingresos a la
 * izquierda, egresos a la derecha, mismo criterio visual que Movimientos
 * (ver `CashMovementsBoard`). Los meses más viejos quedan detrás de "Ver
 * meses anteriores" (igual patrón que "Cargar más" en
 * `ProviderCard`/`AccountCard`, a nivel mes en vez de fila) — igual siguen
 * colapsados por default al revelarse.
 */
export function AccountLedgerMonths({
  groups,
  currentMonthKey,
  paymentMethods,
  expenseCategories,
  fundMovements = null,
}: {
  groups: ProviderLedgerMonthGroup<CashMovementRow>[];
  currentMonthKey: string;
  paymentMethods: PaymentMethodOption[];
  expenseCategories: ExpenseCategoryOption[];
  /** Si la cuenta tiene fondos de inversión habilitados: cambia "Balance del
   *  mes" por Ingresos/Egresos/En Fondos (saldo acumulado del fondo a fin de
   *  ese mes) — ver `FundsSection`. */
  fundMovements?: FundMovementRow[] | null;
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
        const fundEnd = fundMovements ? fundBalanceAtMonthEnd(fundMovements, g.key) : null;
        return (
          <details
            key={g.key}
            open={g.key === currentMonthKey}
            className="rounded-xl border border-foreground/10 p-4"
          >
            <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-3 [&::-webkit-details-marker]:hidden">
              <h3 className="text-base font-semibold">{g.label}</h3>
              {fundEnd ? (
                <div className="grid grid-cols-3 gap-3 text-right">
                  <MiniStat label="Ingresos" totals={incomeTotals} />
                  <MiniStat label="Egresos" totals={expenseTotals} />
                  <MiniStat label="En Fondos" totals={fundEnd} />
                </div>
              ) : (
                <div className="text-right">
                  <p className="text-xs text-foreground/50">Balance del mes</p>
                  <CurrencyTotalsDisplay totals={net} size="text-base" />
                </div>
              )}
            </summary>
            <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
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
                        key={`${r.id}:${r.description}:${r.amount}:${r.currency}:${r.paymentMethodName}:${r.paymentMethodNote ?? ""}`}
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
                        key={`${r.id}:${r.description}:${r.amount}:${r.currency}:${r.paymentMethodName}:${r.paymentMethodNote ?? ""}:${r.recipientPaymentMethodName ?? ""}:${r.recipientPaymentMethodNote ?? ""}:${r.categoryName ?? ""}`}
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
          </details>
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
