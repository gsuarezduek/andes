"use client";

import { useState } from "react";
import type { PaymentMethodOwnership } from "@prisma/client";
import { SectionTitle } from "@/components/ui/section-title";
import { SelectField } from "@/components/ui/fields";
import { formatArs } from "@/lib/contract";
import { MovementRow } from "./movement-row";
import type { CashMovementRow } from "@/lib/cash";

export type PaymentMethodOption = {
  id: string;
  name: string;
  requiresNote?: boolean;
  ownership: PaymentMethodOwnership;
};

function sum(rows: CashMovementRow[]): number {
  return rows.reduce((acc, r) => acc + r.amount, 0);
}

/** Ingresos y egresos del mes, con un filtro por cuenta (medio de pago) compartido entre las dos columnas. */
export function CashMovementsBoard({
  incomes,
  expenses,
  paymentMethods,
}: {
  incomes: CashMovementRow[];
  expenses: CashMovementRow[];
  paymentMethods: PaymentMethodOption[];
}) {
  const [accountId, setAccountId] = useState("");

  // Un Egreso puede matchear el filtro por su Origen (cuenta propia) o su
  // Destino (cuenta ajena) — nunca ambos a la vez, ya que una cuenta es una
  // cosa u otra (ownership es fijo), así que no hay ambigüedad.
  const filteredIncomes = accountId ? incomes.filter((r) => r.paymentMethodId === accountId) : incomes;
  const filteredExpenses = accountId
    ? expenses.filter((r) => r.paymentMethodId === accountId || r.recipientPaymentMethodId === accountId)
    : expenses;
  const selectedAccount = paymentMethods.find((m) => m.id === accountId);
  const ownMethods = paymentMethods.filter((m) => m.ownership === "own");
  const thirdPartyMethods = paymentMethods.filter((m) => m.ownership === "third_party");

  return (
    <div className="flex flex-col gap-4">
      <SelectField
        id="accountFilter"
        label="Filtrar por cuenta"
        value={accountId}
        onChange={(e) => setAccountId(e.target.value)}
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
      </SelectField>

      {selectedAccount && (
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg border border-foreground/10 p-3">
            <p className="text-xs text-foreground/50">Ingresos · {selectedAccount.name}</p>
            <p className="text-lg font-semibold text-emerald-600">{formatArs(sum(filteredIncomes))}</p>
          </div>
          <div className="rounded-lg border border-foreground/10 p-3">
            <p className="text-xs text-foreground/50">Egresos · {selectedAccount.name}</p>
            <p className="text-lg font-semibold text-red-600">{formatArs(sum(filteredExpenses))}</p>
          </div>
          <div className="rounded-lg border border-foreground/10 p-3">
            <p className="text-xs text-foreground/50">Neto · {selectedAccount.name}</p>
            <p className="text-lg font-semibold">{formatArs(sum(filteredIncomes) - sum(filteredExpenses))}</p>
          </div>
        </div>
      )}

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
              key={`${r.id}:${r.description}:${r.amount}:${r.paymentMethodName}:${r.paymentMethodNote ?? ""}:${r.recipientPaymentMethodName ?? ""}:${r.recipientPaymentMethodNote ?? ""}`}
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
