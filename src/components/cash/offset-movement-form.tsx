"use client";

import { useState } from "react";
import type { PaymentMethodOwnership } from "@prisma/client";
import { SubmitButton } from "@/components/ui/submit-button";
import { SelectField, TextField, TextareaField } from "@/components/ui/fields";
import { CurrencyToggle } from "@/components/cash/currency-toggle";
import { createOffsetMovement } from "@/app/(app)/caja/offset-actions";
import { groupSubaccounts } from "@/lib/subaccount-order";
import type { Currency } from "@/lib/currency";

export type OffsetAccountOption = {
  id: string;
  name: string;
  ownership?: PaymentMethodOwnership;
  parentId?: string | null;
};

/**
 * "Compensar": le pagamos a esta cuenta corriente (ej. la dueña de un auto)
 * cargándole la deuda a otra (ej. el taller que arregló su auto), sin
 * movimiento de caja — ver `createOffsetMovement`. Vive inline en la tarjeta
 * y en la página de la cuenta, así que la cuenta que cobra ya viene fija.
 * `accounts` es la lista de medios de pago; acá se filtran los proveedores y
 * asociados de OTRAS entidades.
 */
export function OffsetMovementForm({
  onCancel,
  onSuccess,
  account,
  accounts,
}: {
  onCancel: () => void;
  onSuccess?: () => void;
  account: { id: string; name: string };
  accounts: OffsetAccountOption[];
}) {
  const [currency, setCurrency] = useState<Currency>("ars");
  const [creditorId, setCreditorId] = useState("");
  const [error, setError] = useState<string>();

  const others = accounts.filter((a) => a.id !== account.id && a.parentId !== account.id);
  const providers = groupSubaccounts(others.filter((a) => a.ownership === "provider"));
  const associates = groupSubaccounts(others.filter((a) => a.ownership === "associate"));
  const creditor = others.find((a) => a.id === creditorId);

  async function submit(formData: FormData) {
    setError(undefined);
    const result = await createOffsetMovement(formData);
    if (result.error) {
      setError(result.error);
      return;
    }
    onSuccess?.();
  }

  return (
    <form action={submit} className="flex flex-col gap-3 rounded-xl border border-foreground/10 p-4">
      <input type="hidden" name="payeeAccountId" value={account.id} />
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Compensación — {account.name}</h4>
        <button type="button" onClick={onCancel} className="text-xs text-foreground/50">
          Cancelar
        </button>
      </div>
      <p className="-mt-1 text-xs text-foreground/50">
        Para cuando le pagamos a {account.name} contrayendo una deuda con otra cuenta corriente (ej. el
        arreglo de su auto lo hizo un taller al que le quedamos debiendo). No mueve caja.
      </p>
      <SelectField
        id="creditorAccountId"
        label="Se le carga la deuda a"
        required
        value={creditorId}
        onChange={(e) => setCreditorId(e.target.value)}
      >
        <option value="" disabled>
          Elegí la otra cuenta
        </option>
        {providers.length > 0 && (
          <optgroup label="Proveedores">
            {providers.map(({ item, isChild }) => (
              <option key={item.id} value={item.id}>
                {isChild ? `↳ ${item.name}` : item.name}
              </option>
            ))}
          </optgroup>
        )}
        {associates.length > 0 && (
          <optgroup label="Asociados">
            {associates.map(({ item, isChild }) => (
              <option key={item.id} value={item.id}>
                {isChild ? `↳ ${item.name}` : item.name}
              </option>
            ))}
          </optgroup>
        )}
      </SelectField>
      <TextareaField
        id="description"
        label="Detalle"
        required
        rows={2}
        placeholder="Ej: Batería auto de Claudia — arreglo en el taller"
      />
      <div className="grid grid-cols-[7fr_3fr] gap-2">
        <TextField id="amount" label="Monto" type="number" step="0.01" min="0" prefix="$" required />
        <CurrencyToggle value={currency} onChange={setCurrency} />
      </div>
      {creditor && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400">
          Se anota un <strong>pago</strong> a {account.name} y la misma <strong>deuda</strong> en la cuenta
          corriente de {creditor.name}. No aparece ningún movimiento en la caja.
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <SubmitButton pendingLabel="Guardando…">Agregar compensación</SubmitButton>
    </form>
  );
}
