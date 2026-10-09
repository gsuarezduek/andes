"use client";

import { useActionState } from "react";
import { TextField, TextareaField, FormError } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { ButtonLink } from "@/components/ui/button";
import type { FormState } from "@/app/(app)/third-party-vehicles/actions";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

export type ThirdPartyVehicleFormValues = {
  plate: string;
  brand: string;
  model: string;
  year: number | null;
  color: string | null;
  ownerName: string;
  ownerPhone: string | null;
  sortOrder: number | null;
  notes: string | null;
};

export function ThirdPartyVehicleForm({
  action,
  vehicle,
  cancelHref,
}: {
  action: Action;
  vehicle?: ThirdPartyVehicleFormValues;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="plate" label="Patente" required defaultValue={vehicle?.plate} maxLength={20} />
        <TextField id="color" label="Color" defaultValue={vehicle?.color ?? ""} hint="Opcional" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField id="brand" label="Marca" required defaultValue={vehicle?.brand} maxLength={40} />
        <TextField id="model" label="Modelo" required defaultValue={vehicle?.model} maxLength={40} />
        <TextField id="year" label="Año" type="number" inputMode="numeric" min={1950} defaultValue={vehicle?.year ?? ""} hint="Opcional" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="ownerName" label="Nombre del titular" required defaultValue={vehicle?.ownerName} maxLength={80} />
        <TextField id="ownerPhone" label="Teléfono del titular" defaultValue={vehicle?.ownerPhone ?? ""} hint="Opcional" />
      </div>

      <TextField
        id="sortOrder"
        label="Orden en el calendario"
        type="number"
        inputMode="numeric"
        min={1}
        defaultValue={vehicle?.sortOrder ?? ""}
        hint="Opcional — menor = más arriba."
      />
      <TextareaField id="notes" label="Notas" defaultValue={vehicle?.notes ?? ""} />

      <FormError>{state.error}</FormError>

      <div className="flex gap-3">
        <SubmitButton>{vehicle ? "Guardar cambios" : "Cargar vehículo"}</SubmitButton>
        <ButtonLink href={cancelHref} variant="secondary">
          Cancelar
        </ButtonLink>
      </div>
    </form>
  );
}
