"use client";

import { useState } from "react";
import { SectionTitle } from "@/components/ui/section-title";
import { SelectField } from "@/components/ui/fields";
import { MovementRow } from "./movement-row";
import type { CashMovementRow } from "@/lib/cash";

type PaymentMethodOption = { id: string; name: string; requiresNote?: boolean };

/** Cobros y pagos del mes, con un filtro por cuenta (medio de pago) compartido entre las dos columnas. */
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

  const filteredIncomes = accountId ? incomes.filter((r) => r.paymentMethodId === accountId) : incomes;
  const filteredExpenses = accountId ? expenses.filter((r) => r.paymentMethodId === accountId) : expenses;

  return (
    <div className="flex flex-col gap-4">
      <SelectField
        id="accountFilter"
        label="Filtrar por cuenta"
        value={accountId}
        onChange={(e) => setAccountId(e.target.value)}
      >
        <option value="">Todas las cuentas</option>
        {paymentMethods.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </SelectField>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <MovementColumn
          title={`Cobros (${filteredIncomes.length})`}
          rows={filteredIncomes}
          tone="emerald"
          paymentMethods={paymentMethods}
        />
        <MovementColumn
          title={`Pagos (${filteredExpenses.length})`}
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
              key={`${r.id}:${r.description}:${r.amount}:${r.paymentMethodName}:${r.paymentMethodNote ?? ""}`}
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
