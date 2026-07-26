"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextField, TextareaField, SelectField } from "@/components/ui/fields";
import { createCashMovement } from "@/app/(app)/caja/actions";

type PaymentMethodOption = { id: string; name: string };
type RentalOption = { id: string; label: string };

export function CashMovementForm({
  paymentMethods,
  rentalOptions,
}: {
  paymentMethods: PaymentMethodOption[];
  rentalOptions: RentalOption[];
}) {
  const [mode, setMode] = useState<"income" | "expense" | null>(null);

  if (mode === null) {
    return (
      <div className="flex gap-3">
        <Button type="button" className="flex-1" onClick={() => setMode("income")}>
          + Cobro
        </Button>
        <Button type="button" variant="secondary" className="flex-1" onClick={() => setMode("expense")}>
          + Pago
        </Button>
      </div>
    );
  }

  return (
    <form
      action={createCashMovement.bind(null, mode)}
      className="flex flex-col gap-3 rounded-xl border border-foreground/10 p-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{mode === "income" ? "Nuevo cobro" : "Nuevo pago"}</h2>
        <button type="button" onClick={() => setMode(null)} className="text-xs text-foreground/50">
          Cancelar
        </button>
      </div>
      <TextareaField
        id="description"
        label="Detalle"
        required
        rows={2}
        placeholder="Ej: seña reserva Juan Pérez"
      />
      <TextField id="amount" label="Monto" type="number" step="0.01" min="0" prefix="$" required />
      <SelectField id="paymentMethodId" label="Medio de pago" required defaultValue="">
        <option value="" disabled>
          Elegí un medio de pago
        </option>
        {paymentMethods.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </SelectField>
      <SelectField id="rentalId" label="Reserva (opcional)" defaultValue="">
        <option value="">Sin vincular a una reserva</option>
        {rentalOptions.map((r) => (
          <option key={r.id} value={r.id}>
            {r.label}
          </option>
        ))}
      </SelectField>
      <SubmitButton pendingLabel="Guardando…">
        {mode === "income" ? "Agregar cobro" : "Agregar pago"}
      </SubmitButton>
    </form>
  );
}
