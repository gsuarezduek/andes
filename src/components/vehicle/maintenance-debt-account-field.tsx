"use client";

import { useState } from "react";
import type { PaymentMethodOwnership } from "@prisma/client";
import { SelectField, TextField } from "@/components/ui/fields";
import { groupSubaccounts } from "@/lib/subaccount-order";

export type DebtAccountOption = {
  id: string;
  name: string;
  requiresNote: boolean;
  ownership: PaymentMethodOwnership;
  parentId?: string | null;
};

/**
 * "¿A quién se le debe?" del costo de un mantenimiento: el gasto no sale de
 * caja en el momento, queda como **deuda** en la cuenta corriente del
 * proveedor/asociado (ver `buildMaintenanceDebt`); el pago real se anota
 * después desde Caja. Viaja como `accountId` (+ `accountNote` si la cuenta
 * exige aclaración). `<select>` nativo (no `PaymentMethodPicker`) para que
 * `required` lo valide el navegador antes de enviar.
 *
 * Excepción: la casilla "No cargar deuda" (`skipDebt`) deja el costo anotado
 * en el mantenimiento sin crear la deuda — para cuando se registra aparte con
 * una compensación entre cuentas corrientes (Caja → Compensar), que ya crea
 * esa deuda; si no, quedaría duplicada.
 */
export function MaintenanceDebtAccountField({ accounts }: { accounts: DebtAccountOption[] }) {
  const [accountId, setAccountId] = useState("");
  const [skipDebt, setSkipDebt] = useState(false);
  const selected = accounts.find((a) => a.id === accountId);
  const providers = groupSubaccounts(accounts.filter((a) => a.ownership === "provider"));
  const associates = groupSubaccounts(accounts.filter((a) => a.ownership === "associate"));

  const skipCheckbox = (
    <label className="flex items-start gap-2 text-sm text-foreground/70">
      <input
        type="checkbox"
        name="skipDebt"
        checked={skipDebt}
        onChange={(e) => setSkipDebt(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-foreground/30"
      />
      <span>
        No cargar deuda
        <span className="block text-xs text-foreground/50">
          Solo deja anotado el costo. Usalo cuando lo vas a registrar con una compensación entre cuentas
          corrientes (Caja → Compensar), que ya carga la deuda.
        </span>
      </span>
    </label>
  );

  if (skipDebt) {
    return (
      <>
        {skipCheckbox}
        <p className="rounded-lg border border-foreground/10 bg-foreground/5 p-3 text-sm text-foreground/70">
          El costo queda anotado en el mantenimiento, pero <strong>no se carga ninguna deuda</strong> ni
          movimiento de caja. Acordate de registrar la compensación desde Caja.
        </p>
      </>
    );
  }

  if (accounts.length === 0) {
    return (
      <>
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400">
          No hay proveedores cargados. Creá uno en Configuración → Medios de pago (pestaña Proveedores) para
          poder cargarle la deuda.
        </p>
        {skipCheckbox}
      </>
    );
  }

  return (
    <>
      <SelectField
        id="accountId"
        label="Proveedor"
        hint={selected ? undefined : "A quién se le debe este gasto."}
        required
        value={accountId}
        onChange={(e) => setAccountId(e.target.value)}
      >
        <option value="" disabled>
          Elegí a quién se le debe
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
      {selected && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400">
          Se anota como <strong>deuda</strong> en la cuenta corriente de <strong>{selected.name}</strong>. No
          aparece como egreso en la caja: el pago se registra después, cuando se le pague, desde Caja →{" "}
          {selected.ownership === "associate" ? "Asociados" : "Cuentas corrientes"}.
        </p>
      )}
      {selected?.requiresNote && (
        <TextField id="accountNote" label="¿A dónde fue?" hint="Obligatorio para esta cuenta" required />
      )}
      {skipCheckbox}
    </>
  );
}
