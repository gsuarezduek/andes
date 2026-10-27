"use client";

import { useState } from "react";
import { TextField, SelectField, TextareaField } from "@/components/ui/fields";
import { formatDateInput } from "@/lib/datetime";
import { MaintenanceDebtAccountField, type DebtAccountOption } from "./maintenance-debt-account-field";

export type MaintenanceTypeOption = { value: string; label: string };

/**
 * Campos del formulario de service/arreglo (tipo, fecha, km, costo, lugar,
 * descripción y, si hay costo, a qué proveedor se le debe — el costo queda
 * como deuda en su cuenta corriente, ver `buildMaintenanceDebt`) — antes copiado tres
 * veces (ficha del vehículo, acceso rápido del header de la reserva, y el
 * bloque que daba de baja el auto) con un className hecho a mano en cada
 * una. `types` deja elegir qué opciones ofrece el <select> (el acceso
 * rápido de la reserva solo ofrece Service/Arreglo). `showCost=false`
 * (formulario de "marcar service" desde una reserva) oculta costo/proveedor — ahí muchas veces todavía no se sabe cuánto va a salir; se carga
 * al cerrar el service, con `returnVehicleFromService`.
 */
export function MaintenanceFormFields({
  types,
  defaultType,
  currentKm,
  debtAccounts = [],
  showCost = true,
}: {
  types: MaintenanceTypeOption[];
  defaultType?: string;
  currentKm?: number | null;
  /** Proveedores/asociados a los que se les puede cargar la deuda del costo. */
  debtAccounts?: DebtAccountOption[];
  showCost?: boolean;
}) {
  const [cost, setCost] = useState("");
  const hasCost = showCost && cost.trim() !== "" && Number(cost) > 0;

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <SelectField id="type" label="Tipo" defaultValue={defaultType ?? types[0]?.value}>
          {types.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </SelectField>
        <TextField id="date" label="Fecha" type="date" required defaultValue={formatDateInput(new Date())} />
        <TextField id="km" label="Km" type="number" inputMode="numeric" defaultValue={currentKm ?? ""} />
        {showCost && (
          <TextField
            id="cost"
            label="Costo"
            type="text"
            inputMode="decimal"
            prefix="$"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
          />
        )}
      </div>
      <TextField id="place" label="Lugar / taller" placeholder="Opcional" />
      <TextareaField id="description" label="Descripción" required rows={2} placeholder="Ej. cambio de aceite y filtros" />
      {hasCost && <MaintenanceDebtAccountField accounts={debtAccounts} />}
    </>
  );
}
