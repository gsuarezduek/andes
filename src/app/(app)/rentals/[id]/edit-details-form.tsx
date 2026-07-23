"use client";

import { useActionState } from "react";
import { TextField, SelectField, FormError } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { updateRentalDetails } from "../actions/update-details";
import type { FormState } from "../actions/schemas";

type VehicleOption = { id: string; label: string };

/**
 * Edición rápida (antes de la entrega) de los datos de contacto del cliente y
 * el vehículo asignado, directamente en el detalle del alquiler. Al guardar,
 * el wizard de entrega ya no vuelve a pedir estos datos.
 */
export function EditDetailsForm({
  rentalId,
  clientName,
  clientEmail,
  clientPhone,
  clientDocNumber,
  clientAddress,
  vehicleId,
  vehicles,
}: {
  rentalId: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientDocNumber: string;
  clientAddress: string;
  vehicleId: string;
  vehicles: VehicleOption[];
}) {
  const [state, formAction] = useActionState<FormState, FormData>(updateRentalDetails, {});

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-xl border border-foreground/10 p-4">
      <p className="text-sm font-medium text-foreground/80">Datos del cliente y vehículo</p>
      <input type="hidden" name="rentalId" value={rentalId} />
      <TextField id="clientName" label="Nombre y apellido" defaultValue={clientName} required />
      <div className="grid grid-cols-2 gap-3">
        <TextField id="clientDocNumber" label="Documento" defaultValue={clientDocNumber} />
        <TextField id="clientPhone" label="Teléfono" type="tel" defaultValue={clientPhone} />
      </div>
      <TextField
        id="clientEmail"
        label="Email"
        type="email"
        defaultValue={clientEmail}
        hint="Ahí llega el acta firmada."
      />
      <TextField id="clientAddress" label="Domicilio en Mendoza" defaultValue={clientAddress} />
      <SelectField
        id="vehicleId"
        label="Vehículo"
        defaultValue={vehicleId}
        hint="Se puede asignar o cambiar antes de la entrega."
      >
        <option value="">Sin asignar</option>
        {vehicles.map((v) => (
          <option key={v.id} value={v.id}>
            {v.label}
          </option>
        ))}
      </SelectField>

      <FormError>{state.error}</FormError>
      {state.ok && (
        <p className="rounded-lg bg-green-500/10 px-3 py-2 text-sm font-medium text-green-700 dark:text-green-400">
          Datos guardados.
        </p>
      )}

      <div className="flex gap-3">
        <SubmitButton variant="secondary">Guardar datos</SubmitButton>
        <SubmitButton name="intent" value="startHandover" pendingLabel="Guardando…" className="flex-1">
          Guardar e iniciar entrega
        </SubmitButton>
      </div>
    </form>
  );
}
