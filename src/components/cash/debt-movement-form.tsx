"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextField, TextareaField } from "@/components/ui/fields";
import { CurrencyToggle } from "@/components/cash/currency-toggle";
import { createDebtMovement } from "@/app/(app)/caja/debt-actions";
import type { Currency } from "@/lib/currency";

/**
 * Alta de una deuda con una cuenta ajena puntual (proveedor o asociado):
 * alguien pagó o hizo algo que le correspondía a la empresa sin que se le
 * devuelva en el momento — queda anotada a cuenta corriente (sin Origen, no
 * sale plata todavía) y se salda después con un pago o cuando el cliente le
 * paga directo (ver `src/lib/third-party-accounts.ts`). Vive inline en la
 * tarjeta de esa cuenta (`ProviderCard`/`AssociateCard`), así que ya viene
 * fija — no hay buscador. `onSuccess` cierra el form de vuelta a los botones
 * tras guardar.
 */
export function DebtMovementForm({
  onCancel,
  onSuccess,
  account,
}: {
  onCancel: () => void;
  onSuccess?: () => void;
  account: { id: string; name: string };
}) {
  const [currency, setCurrency] = useState<Currency>("ars");

  async function submit(formData: FormData) {
    await createDebtMovement(formData);
    onSuccess?.();
  }

  return (
    <form action={submit} className="flex flex-col gap-3 rounded-xl border border-foreground/10 p-4">
      <input type="hidden" name="accountId" value={account.id} />
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Nueva deuda — {account.name}</h4>
        <button type="button" onClick={onCancel} className="text-xs text-foreground/50">
          Cancelar
        </button>
      </div>
      <p className="-mt-1 text-xs text-foreground/50">
        Para cuando pagan o hacen algo que le correspondía a la empresa, sin que se les devuelva en
        el momento — queda a cuenta corriente y se salda después con un pago o cuando el cliente le
        paga directo.
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
      <SubmitButton pendingLabel="Guardando…">Agregar deuda</SubmitButton>
    </form>
  );
}
