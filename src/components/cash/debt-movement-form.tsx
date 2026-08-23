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
 */
export function DebtMovementForm({
  onCancel,
  providers,
}: {
  onCancel: () => void;
  providers: ProviderOption[];
}) {
  const [providerId, setProviderId] = useState("");
  const [currency, setCurrency] = useState<Currency>("ars");

  return (
    <form
      action={createDebtMovement}
      className="flex flex-col gap-3 rounded-xl border border-foreground/10 p-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Nueva deuda</h2>
        <button type="button" onClick={onCancel} className="text-xs text-foreground/50">
          Cancelar
        </button>
      </div>
      {providers.length === 0 ? (
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
          <PaymentMethodPicker
            id="providerId"
            name="providerId"
            label="Proveedor"
            options={providers}
            value={providerId}
            onChange={setProviderId}
            placeholder="Buscar proveedor…"
          />
        </>
      )}
      <SubmitButton pendingLabel="Guardando…" disabled={providers.length === 0 || !providerId}>
        Agregar deuda
      </SubmitButton>
    </form>
  );
}
