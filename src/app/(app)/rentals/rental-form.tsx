"use client";

import { useActionState } from "react";
import { TextField, SelectField, FormError } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { ButtonLink } from "@/components/ui/button";
import { languageLabels } from "@/lib/labels";
import type { FormState } from "./actions";

type VehicleOption = { id: string; label: string };

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

export function RentalForm({
  action,
  vehicles,
}: {
  action: Action;
  vehicles: VehicleOption[];
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <TextField id="clientName" label="Nombre del cliente" required />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="clientEmail" label="Email" type="email" hint="Opcional — para enviar el acta" />
        <TextField id="clientPhone" label="Teléfono" hint="Opcional" />
      </div>
      <TextField id="clientDocNumber" label="Nro. de documento" hint="Opcional" />
      <TextField id="clientAddress" label="Domicilio en Mendoza" hint="Opcional" />

      <SelectField id="vehicleId" label="Vehículo" hint="Se puede asignar más tarde">
        <option value="">Sin asignar</option>
        {vehicles.map((v) => (
          <option key={v.id} value={v.id}>
            {v.label}
          </option>
        ))}
      </SelectField>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="startAt" label="Retiro" type="datetime-local" required />
        <TextField id="endAt" label="Devolución" type="datetime-local" required />
      </div>

      <SelectField id="language" label="Idioma del cliente" defaultValue="es" hint="Para el acta y los emails">
        {Object.entries(languageLabels).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </SelectField>

      <FormError>{state.error}</FormError>

      <div className="flex gap-3">
        <SubmitButton>Crear alquiler</SubmitButton>
        <ButtonLink href="/rentals" variant="secondary">
          Cancelar
        </ButtonLink>
      </div>
    </form>
  );
}
