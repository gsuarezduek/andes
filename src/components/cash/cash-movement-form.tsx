"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextField, TextareaField, SelectField } from "@/components/ui/fields";
import { RentalPicker } from "@/components/cash/rental-picker";
import { createCashMovement } from "@/app/(app)/caja/actions";
import type { RentalPickerOption } from "@/lib/cash";

type PaymentMethodOption = { id: string; name: string; requiresNote: boolean };

/** Formulario de alta de un cobro o un pago. `mode` lo fija el botón que lo
 *  abrió (ver MovementLauncher) — este componente ya no maneja ese estado. */
export function CashMovementForm({
  mode,
  onCancel,
  paymentMethods,
  rentalOptions,
}: {
  mode: "income" | "expense";
  onCancel: () => void;
  paymentMethods: PaymentMethodOption[];
  rentalOptions: RentalPickerOption[];
}) {
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const selectedMethod = paymentMethods.find((m) => m.id === paymentMethodId);

  return (
    <form
      action={createCashMovement.bind(null, mode)}
      className="flex flex-col gap-3 rounded-xl border border-foreground/10 p-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{mode === "income" ? "Nuevo cobro" : "Nuevo pago"}</h2>
        <button type="button" onClick={onCancel} className="text-xs text-foreground/50">
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
      <SelectField
        id="paymentMethodId"
        label="Medio de pago"
        required
        value={paymentMethodId}
        onChange={(e) => setPaymentMethodId(e.target.value)}
      >
        <option value="" disabled>
          Elegí un medio de pago
        </option>
        {paymentMethods.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </SelectField>
      {selectedMethod?.requiresNote && (
        <TextField
          id="paymentMethodNote"
          label="¿A dónde fue?"
          hint="Obligatorio para este medio de pago"
          required
        />
      )}
      {mode === "income" && <RentalPicker options={rentalOptions} />}
      <SubmitButton pendingLabel="Guardando…">
        {mode === "income" ? "Agregar cobro" : "Agregar pago"}
      </SubmitButton>
    </form>
  );
}
