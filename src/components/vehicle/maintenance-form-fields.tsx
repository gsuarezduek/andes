"use client";

import { useState } from "react";
import { TextField, SelectField, TextareaField } from "@/components/ui/fields";
import { formatDateInput } from "@/lib/datetime";

export type PaymentMethodOption = { id: string; name: string; requiresNote: boolean };
export type MaintenanceTypeOption = { value: string; label: string };

/**
 * Campos del formulario de service/arreglo (tipo, fecha, km, costo, lugar,
 * descripción y, si hay costo, de dónde sale la plata) — antes copiado tres
 * veces (ficha del vehículo, acceso rápido del header de la reserva, y el
 * bloque que daba de baja el auto) con un className hecho a mano en cada
 * una. `types` deja elegir qué opciones ofrece el <select> (el acceso
 * rápido de la reserva solo ofrece Service/Arreglo).
 */
export function MaintenanceFormFields({
  types,
  defaultType,
  currentKm,
  paymentMethods,
}: {
  types: MaintenanceTypeOption[];
  defaultType?: string;
  currentKm?: number | null;
  paymentMethods: PaymentMethodOption[];
}) {
  const [cost, setCost] = useState("");
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const selectedMethod = paymentMethods.find((m) => m.id === paymentMethodId);
  const hasCost = cost.trim() !== "" && Number(cost) > 0;

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
        <TextField
          id="cost"
          label="Costo"
          type="text"
          inputMode="decimal"
          prefix="$"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
        />
      </div>
      <TextField id="place" label="Lugar / taller" placeholder="Opcional" />
      <TextareaField id="description" label="Descripción" required rows={2} placeholder="Ej. cambio de aceite y filtros" />
      {hasCost && (
        <>
          <SelectField
            id="paymentMethodId"
            label="De dónde sale"
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
        </>
      )}
    </>
  );
}
