"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextField, TextareaField } from "@/components/ui/fields";
import { CurrencyToggle } from "@/components/cash/currency-toggle";
import { PaymentMethodPicker } from "@/components/cash/payment-method-picker";
import { createCashMovement } from "@/app/(app)/caja/actions";
import type { Currency } from "@/lib/currency";

/**
 * Alta de un ingreso que entró directo a la cuenta de un asociado puntual
 * (ej. el cliente le pagó directo a él) — es un Ingreso normal (mismo
 * `createCashMovement`, medio de pago = una cuenta de esta entidad), solo que
 * el medio ya viene acotado a las cuentas de esta entidad (la principal +
 * subcuentas, si tiene) y preseleccionado en la principal. El formulario se
 * reduce a Detalle + Monto + Cuenta. `onSuccess` cierra el form de vuelta a
 * los dos botones para que se vea el total actualizado.
 */
export function AssociateIncomeForm({
  onCancel,
  onSuccess,
  account,
  cuentaOptions,
}: {
  onCancel: () => void;
  onSuccess?: () => void;
  account: { id: string; name: string };
  cuentaOptions: { id: string; name: string; requiresNote?: boolean }[];
}) {
  const [cuentaId, setCuentaId] = useState(account.id);
  const [currency, setCurrency] = useState<Currency>("ars");
  const selectedCuenta = cuentaOptions.find((m) => m.id === cuentaId);

  async function submit(formData: FormData) {
    await createCashMovement("income", formData);
    onSuccess?.();
  }

  return (
    <form action={submit} className="flex flex-col gap-3 rounded-xl border border-foreground/10 p-4">
      {/* Con una sola cuenta posible (sin subcuentas) va fijo por hidden input;
          con varias, el picker de abajo ya manda su propio hidden input con
          este mismo name — no duplicar el campo. */}
      {cuentaOptions.length <= 1 && <input type="hidden" name="paymentMethodId" value={cuentaId} />}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Nuevo ingreso — {account.name}</h4>
        <button type="button" onClick={onCancel} className="text-xs text-foreground/50">
          Cancelar
        </button>
      </div>
      <TextareaField
        id="description"
        label="Detalle"
        required
        rows={2}
        placeholder="Ej: Cliente le pagó directo — reserva #1234"
      />
      <div className="grid grid-cols-[7fr_3fr] gap-2">
        <TextField id="amount" label="Monto" type="number" step="0.01" min="0" prefix="$" required />
        <CurrencyToggle value={currency} onChange={setCurrency} />
      </div>
      {cuentaOptions.length > 1 && (
        <PaymentMethodPicker
          id="paymentMethodId"
          label="Cuenta"
          hint={`Por cuál cuenta de ${account.name} entró este ingreso.`}
          options={cuentaOptions}
          value={cuentaId}
          onChange={setCuentaId}
        />
      )}
      {selectedCuenta?.requiresNote && (
        <TextField id="paymentMethodNote" label="¿A dónde fue?" hint="Obligatorio para este medio de pago" required />
      )}
      <SubmitButton pendingLabel="Guardando…">Agregar ingreso</SubmitButton>
    </form>
  );
}
