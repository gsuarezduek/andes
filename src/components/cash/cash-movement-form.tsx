"use client";

import { useState } from "react";
import type { PaymentMethodOwnership } from "@prisma/client";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextField, TextareaField, SelectField } from "@/components/ui/fields";
import { RentalPicker } from "@/components/cash/rental-picker";
import { CurrencyToggle } from "@/components/cash/currency-toggle";
import { createCashMovement } from "@/app/(app)/caja/actions";
import type { RentalPickerOption } from "@/lib/cash";
import type { Currency } from "@/lib/currency";

type PaymentMethodOption = { id: string; name: string; requiresNote: boolean; ownership: PaymentMethodOwnership };

/**
 * Formulario de alta de un ingreso o un egreso. `mode` lo fija el botón que
 * lo abrió (ver MovementLauncher) — este componente ya no maneja ese estado.
 *
 * En un Egreso hay dos cuentas: Origen (de dónde sale la plata, cualquier
 * cuenta, obligatorio) y Destino (a quién se le paga, solo cuentas ajenas,
 * opcional). En un Ingreso sigue siendo un único "Medio de pago" con todas
 * las cuentas, como antes.
 */
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
  const [recipientPaymentMethodId, setRecipientPaymentMethodId] = useState("");
  const [currency, setCurrency] = useState<Currency>("ars");
  const selectedMethod = paymentMethods.find((m) => m.id === paymentMethodId);
  const selectedRecipient = paymentMethods.find((m) => m.id === recipientPaymentMethodId);

  const thirdPartyMethods = paymentMethods.filter((m) => m.ownership === "third_party");

  return (
    <form
      action={createCashMovement.bind(null, mode)}
      className="flex flex-col gap-3 rounded-xl border border-foreground/10 p-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{mode === "income" ? "Nuevo ingreso" : "Nuevo egreso"}</h2>
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
      <CurrencyToggle value={currency} onChange={setCurrency} />
      <TextField id="amount" label="Monto" type="number" step="0.01" min="0" prefix="$" required />
      <SelectField
        id="paymentMethodId"
        label={mode === "expense" ? "Origen" : "Medio de pago"}
        required
        value={paymentMethodId}
        onChange={(e) => setPaymentMethodId(e.target.value)}
      >
        <option value="" disabled>
          {mode === "expense" ? "Elegí de dónde sale la plata" : "Elegí un medio de pago"}
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
      {mode === "expense" && (
        <>
          <SelectField
            id="recipientPaymentMethodId"
            label="Destino"
            hint="Opcional — cuenta ajena a la que se le pagó"
            value={recipientPaymentMethodId}
            onChange={(e) => setRecipientPaymentMethodId(e.target.value)}
          >
            <option value="">Sin destino específico</option>
            {thirdPartyMethods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </SelectField>
          {selectedRecipient?.requiresNote && (
            <TextField
              id="recipientPaymentMethodNote"
              label="¿A dónde fue? (destino)"
              hint="Obligatorio para este destino"
              required
            />
          )}
        </>
      )}
      {mode === "income" && <RentalPicker options={rentalOptions} />}
      <SubmitButton pendingLabel="Guardando…">
        {mode === "income" ? "Agregar ingreso" : "Agregar egreso"}
      </SubmitButton>
    </form>
  );
}
