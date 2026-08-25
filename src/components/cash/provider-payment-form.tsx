"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextField, TextareaField } from "@/components/ui/fields";
import { CurrencyToggle } from "@/components/cash/currency-toggle";
import { PaymentMethodPicker } from "@/components/cash/payment-method-picker";
import { createCashMovement } from "@/app/(app)/caja/actions";
import type { Currency } from "@/lib/currency";

type PaymentMethodOption = { id: string; name: string; requiresNote?: boolean };

/**
 * Alta de un pago a un proveedor puntual — es un Egreso normal (mismo
 * `createCashMovement`, Destino = una cuenta de este proveedor), solo que el
 * Destino ya viene acotado a las cuentas de esta entidad (la principal +
 * subcuentas, si tiene — ver `PaymentMethod.parentId`), preseleccionada en la
 * principal, así se sabe por cuál rail salió sin tener que buscarla entre
 * todas las cuentas. El formulario se reduce a Detalle + Monto + Origen +
 * Destino. Aparece en Caja/Movimientos y en el saldo de cuenta corriente de
 * este proveedor igual que si se hubiera cargado desde ahí. Tras guardar,
 * `onSuccess` cierra el form de vuelta a los dos botones para que se vea el
 * saldo actualizado.
 */
export function ProviderPaymentForm({
  onCancel,
  onSuccess,
  provider,
  destinoOptions,
  paymentMethods,
}: {
  onCancel: () => void;
  onSuccess?: () => void;
  provider: { id: string; name: string };
  destinoOptions: { id: string; name: string }[];
  paymentMethods: PaymentMethodOption[];
}) {
  const [originId, setOriginId] = useState("");
  const [destinoId, setDestinoId] = useState(provider.id);
  const [currency, setCurrency] = useState<Currency>("ars");
  const selectedOrigin = paymentMethods.find((m) => m.id === originId);

  async function submit(formData: FormData) {
    await createCashMovement("expense", formData);
    onSuccess?.();
  }

  return (
    <form action={submit} className="flex flex-col gap-3 rounded-xl border border-foreground/10 p-4">
      {/* Con una sola cuenta posible (sin subcuentas) va fijo por hidden input;
          con varias, el picker de abajo ya manda su propio hidden input con
          este mismo name — no duplicar el campo. */}
      {destinoOptions.length <= 1 && (
        <input type="hidden" name="recipientPaymentMethodId" value={destinoId} />
      )}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Nuevo pago — {provider.name}</h4>
        <button type="button" onClick={onCancel} className="text-xs text-foreground/50">
          Cancelar
        </button>
      </div>
      <TextareaField
        id="description"
        label="Detalle"
        required
        rows={2}
        placeholder="Ej: Pago service auto AB123CD"
      />
      <div className="grid grid-cols-[7fr_3fr] gap-2">
        <TextField id="amount" label="Monto" type="number" step="0.01" min="0" prefix="$" required />
        <CurrencyToggle value={currency} onChange={setCurrency} />
      </div>
      <PaymentMethodPicker
        id="paymentMethodId"
        label="Origen"
        options={paymentMethods}
        value={originId}
        onChange={setOriginId}
        placeholder="Elegí de dónde sale la plata"
      />
      {selectedOrigin?.requiresNote && (
        <TextField
          id="paymentMethodNote"
          label="¿A dónde fue?"
          hint="Obligatorio para este medio de pago"
          required
        />
      )}
      {destinoOptions.length > 1 && (
        <PaymentMethodPicker
          id="recipientPaymentMethodId"
          label="Cuenta"
          hint={`Por cuál cuenta de ${provider.name} salió este pago.`}
          options={destinoOptions}
          value={destinoId}
          onChange={setDestinoId}
        />
      )}
      <SubmitButton pendingLabel="Guardando…" disabled={!originId}>
        Agregar pago
      </SubmitButton>
    </form>
  );
}
