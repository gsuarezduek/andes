"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextField, TextareaField } from "@/components/ui/fields";
import { CurrencyToggle } from "@/components/cash/currency-toggle";
import { PaymentMethodPicker } from "@/components/cash/payment-method-picker";
import { createDebtMovement } from "@/app/(app)/caja/debt-actions";
import type { Currency } from "@/lib/currency";

type ProviderOption = { id: string; name: string };

/**
 * Alta de una deuda: el proveedor hizo el trabajo (service, arreglo, etc.)
 * sin que se le pague en el momento — queda anotada a cuenta corriente (sin
 * Origen, no sale plata todavía) y se salda después con un pago o cuando el
 * cliente le paga directo a él (ver `src/lib/providers.ts`).
 *
 * Dos modos: con `providers` (el "+ Deuda" global de Caja, hay que buscar a
 * quién) o con `fixedProvider` (inline en la tarjeta de un proveedor
 * puntual — ya se sabe a quién, se salta el buscador). `onSuccess` (solo lo
 * usa el modo inline) cierra el form de vuelta a los dos botones tras
 * guardar, para que se vea el saldo actualizado — el modo global sigue
 * quedando abierto para cargar varias deudas seguidas, como el resto de Caja.
 */
export function DebtMovementForm({
  onCancel,
  onSuccess,
  providers = [],
  fixedProvider,
}: {
  onCancel: () => void;
  onSuccess?: () => void;
  providers?: ProviderOption[];
  fixedProvider?: ProviderOption;
}) {
  const [providerId, setProviderId] = useState("");
  const [currency, setCurrency] = useState<Currency>("ars");

  async function submit(formData: FormData) {
    await createDebtMovement(formData);
    onSuccess?.();
  }

  return (
    <form action={submit} className="flex flex-col gap-3 rounded-xl border border-foreground/10 p-4">
      {fixedProvider ? (
        <>
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Nueva deuda — {fixedProvider.name}</h4>
            <button type="button" onClick={onCancel} className="text-xs text-foreground/50">
              Cancelar
            </button>
          </div>
          <input type="hidden" name="providerId" value={fixedProvider.id} />
        </>
      ) : (
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Nueva deuda</h2>
          <button type="button" onClick={onCancel} className="text-xs text-foreground/50">
            Cancelar
          </button>
        </div>
      )}
      {!fixedProvider && providers.length === 0 ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-foreground/70">
          Todavía no hay proveedores configurados. Marcá un medio de pago ajeno como
          &quot;Proveedor&quot; en Configuración → Medios de pago.
        </p>
      ) : (
        <>
          <p className="-mt-1 text-xs text-foreground/50">
            Para cuando el proveedor hace el trabajo sin que se le pague en el momento — queda a
            cuenta corriente y se salda después con un pago o cuando el cliente le paga directo.
          </p>
          <TextareaField
            id="description"
            label="Detalle"
            required
            rows={2}
            placeholder="Ej: Service auto AB123CD — cambio de aceite y filtros"
          />
          <div className="grid grid-cols-[7fr_3fr] gap-2">
            <TextField id="amount" label="Monto" type="number" step="0.01" min="0" prefix="$" required />
            <CurrencyToggle value={currency} onChange={setCurrency} />
          </div>
          {!fixedProvider && (
            <PaymentMethodPicker
              id="providerId"
              name="providerId"
              label="Proveedor"
              options={providers}
              value={providerId}
              onChange={setProviderId}
              placeholder="Buscar proveedor…"
            />
          )}
        </>
      )}
      <SubmitButton
        pendingLabel="Guardando…"
        disabled={!fixedProvider && (providers.length === 0 || !providerId)}
      >
        Agregar deuda
      </SubmitButton>
    </form>
  );
}
