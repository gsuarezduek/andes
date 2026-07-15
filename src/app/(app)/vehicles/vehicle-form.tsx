"use client";

import { useActionState } from "react";
import type { Vehicle } from "@prisma/client";
import { TextField, SelectField, TextareaField, FormError } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { ButtonLink } from "@/components/ui/button";
import { vehicleStatusLabels } from "@/lib/labels";
import type { FormState } from "./actions";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

export function VehicleForm({
  action,
  vehicle,
  cancelHref,
}: {
  action: Action;
  vehicle?: Vehicle;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <TextField id="plate" label="Patente" required defaultValue={vehicle?.plate} maxLength={16} className="uppercase" />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="brand" label="Marca" required defaultValue={vehicle?.brand} />
        <TextField id="model" label="Modelo" required defaultValue={vehicle?.model} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="year" label="Año" type="number" inputMode="numeric" defaultValue={vehicle?.year ?? ""} min={1950} max={2100} />
        <TextField id="color" label="Color" defaultValue={vehicle?.color ?? ""} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="currentKm" label="Kilometraje actual" type="number" inputMode="numeric" defaultValue={vehicle?.currentKm ?? 0} min={0} />
        <TextField id="nextServiceKm" label="Próximo service (km)" hint="Opcional — alimenta las alertas" type="number" inputMode="numeric" defaultValue={vehicle?.nextServiceKm ?? ""} min={0} />
      </div>
      <TextField id="serviceIntervalKm" label="Intervalo de service (km)" hint="Opcional — al registrar un service, el próximo se reprograma solo (ej. 10000)" type="number" inputMode="numeric" defaultValue={vehicle?.serviceIntervalKm ?? ""} min={0} />
      <TextField id="sortOrder" label="Orden en el calendario" hint="Opcional — menor número = más arriba (del más caro al más económico). Vacío queda al final." type="number" inputMode="numeric" defaultValue={vehicle?.sortOrder ?? ""} min={0} />
      <SelectField id="fuelLevels" label="Líneas de combustible" hint="Divisiones de la aguja de nafta para las inspecciones (4 a 16)" defaultValue={vehicle?.fuelLevels ?? 8}>
        {Array.from({ length: 13 }, (_, i) => i + 4).map((n) => (
          <option key={n} value={n}>
            {n} líneas
          </option>
        ))}
      </SelectField>
      <SelectField id="status" label="Estado" defaultValue={vehicle?.status ?? "available"}>
        {Object.entries(vehicleStatusLabels).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </SelectField>
      <TextareaField id="notes" label="Notas" defaultValue={vehicle?.notes ?? ""} />

      <FormError>{state.error}</FormError>

      <div className="flex gap-3">
        <SubmitButton>{vehicle ? "Guardar cambios" : "Crear vehículo"}</SubmitButton>
        <ButtonLink href={cancelHref} variant="secondary">
          Cancelar
        </ButtonLink>
      </div>
    </form>
  );
}
