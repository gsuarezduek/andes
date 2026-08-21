"use client";

import { useState } from "react";
import type { PaymentMethodOwnership } from "@prisma/client";
import { SectionTitle } from "@/components/ui/section-title";
import { MovementRow } from "./movement-row";
import { CashPeriodPicker } from "./cash-period-picker";
import { CurrencyTotalsDisplay } from "./currency-totals-display";
import { sumByCurrency } from "@/lib/currency";
import type { CashMovementRow } from "@/lib/cash";
import type { CashPeriod } from "@/lib/cash-period";

export type PaymentMethodOption = {
  id: string;
  name: string;
  requiresNote?: boolean;
  ownership: PaymentMethodOwnership;
};

/**
 * Ingresos y egresos del período, con un filtro por cuenta (medio de pago,
 * achicado a la izquierda) y el selector de fecha (Hoy/Semana/Mes/fecha
 * puntual, a la derecha) en la misma fila. El filtro de cuenta es
 * client-side sobre los datos ya traídos para el período; el de fecha
 * navega y trae datos nuevos del server (ver CashPeriodPicker).
 */
export function CashMovementsBoard({
  incomes,
  expenses,
  paymentMethods,
  period,
}: {
  incomes: CashMovementRow[];
  expenses: CashMovementRow[];
  paymentMethods: PaymentMethodOption[];
  period: CashPeriod;
}) {
  const [accountId, setAccountId] = useState("");

  // Un Egreso puede matchear el filtro por su Origen (cualquier cuenta) o su
  // Destino (cuenta ajena) — el filter no distingue cuál, así que si por algún
  // motivo coincidieran los dos igual se cuenta una sola vez la fila.
  const filteredIncomes = accountId ? incomes.filter((r) => r.paymentMethodId === accountId) : incomes;
  const filteredExpenses = accountId
    ? expenses.filter((r) => r.paymentMethodId === accountId || r.recipientPaymentMethodId === accountId)
    : expenses;
  const selectedAccount = paymentMethods.find((m) => m.id === accountId);
  const ownMethods = paymentMethods.filter((m) => m.ownership === "own");
  const thirdPartyMethods = paymentMethods.filter((m) => m.ownership === "third_party");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground/80">Cuenta</span>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="h-11 w-48 rounded-lg border border-foreground/15 bg-transparent px-3 text-sm outline-none focus:border-foreground/40"
          >
            <option value="">Todas las cuentas</option>
            {ownMethods.length > 0 && (
              <optgroup label="Propias">
                {ownMethods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </optgroup>
            )}
            {thirdPartyMethods.length > 0 && (
              <optgroup label="Ajenas (Proveedores/Equipo)">
                {thirdPartyMethods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        <CashPeriodPicker period={period} />
      </div>

      {selectedAccount &&
        (() => {
          const incomeTotals = sumByCurrency(filteredIncomes);
          const expenseTotals = sumByCurrency(filteredExpenses);
          const netTotals = { ars: incomeTotals.ars - expenseTotals.ars, usd: incomeTotals.usd - expenseTotals.usd };
          return (
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-lg border border-foreground/10 p-3">
                <p className="text-xs text-foreground/50">Ingresos · {selectedAccount.name}</p>
                <CurrencyTotalsDisplay totals={incomeTotals} toneClass="text-emerald-600" />
              </div>
              <div className="rounded-lg border border-foreground/10 p-3">
                <p className="text-xs text-foreground/50">Egresos · {selectedAccount.name}</p>
                <CurrencyTotalsDisplay totals={expenseTotals} toneClass="text-red-600" />
              </div>
              <div className="rounded-lg border border-foreground/10 p-3">
                <p className="text-xs text-foreground/50">Neto · {selectedAccount.name}</p>
                <CurrencyTotalsDisplay totals={netTotals} />
              </div>
            </div>
          );
        })()}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <MovementColumn
          title={`Ingresos (${filteredIncomes.length})`}
          rows={filteredIncomes}
          tone="emerald"
          paymentMethods={paymentMethods}
        />
        <MovementColumn
          title={`Egresos (${filteredExpenses.length})`}
          rows={filteredExpenses}
          tone="red"
          paymentMethods={paymentMethods}
        />
      </div>
    </div>
  );
}

function MovementColumn({
  title,
  rows,
  tone,
  paymentMethods,
}: {
  title: string;
  rows: CashMovementRow[];
  tone: "emerald" | "red";
  paymentMethods: PaymentMethodOption[];
}) {
  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>{title}</SectionTitle>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-foreground/10 px-3 py-2 text-sm text-foreground/50">
          Sin movimientos.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            // La key incluye los campos editables: tras guardar una edición,
            // cambia y el componente se remonta con los valores nuevos (evita
            // quedar con el form de edición pegado a los datos viejos).
            <MovementRow
              key={`${r.id}:${r.description}:${r.amount}:${r.currency}:${r.paymentMethodName}:${r.paymentMethodNote ?? ""}:${r.recipientPaymentMethodName ?? ""}:${r.recipientPaymentMethodNote ?? ""}`}
              movement={r}
              tone={tone}
              paymentMethods={paymentMethods}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
