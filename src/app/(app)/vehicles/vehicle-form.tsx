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
  isAdmin,
}: {
  action: Action;
  // Sin dailyRate: es un Decimal, no se puede pasar de Server a Client
  // Component, y este form no lo usa (se sincroniza solo desde VikRentCar).
  vehicle?: Omit<Vehicle, "dailyRate">;
  cancelHref: string;
  isAdmin: boolean;
}) {
  const [state, formAction] = useActionState(action, {});

  // Los datos de identidad/legales del auto (patente, marca/modelo, chasis,
  // seguro) solo los toca un admin — son sensibles y difíciles de auditar. Un
  // empleado puede seguir editando lo operativo (estado, km, notas) sin pedir
  // ayuda. El server action vuelve a exigir esto mismo del lado del servidor,
  // así que deshabilitarlos acá es solo para guiar la UI, no la única traba.
  const adminLockedProps = isAdmin
    ? {}
    : { disabled: true, "aria-disabled": true as const };
  const adminLockedClass = isAdmin ? "" : "bg-foreground/[0.03] text-foreground/50";
  const adminLockedHint = isAdmin ? undefined : "Solo un admin puede editar este campo.";

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <TextField
        id="plate"
        label="Patente"
        required
        defaultValue={vehicle?.plate}
        maxLength={16}
        className={`uppercase ${adminLockedClass}`}
        hint={adminLockedHint}
        {...adminLockedProps}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="brand" label="Marca" required defaultValue={vehicle?.brand} className={adminLockedClass} hint={adminLockedHint} {...adminLockedProps} />
        <TextField id="model" label="Modelo" required defaultValue={vehicle?.model} className={adminLockedClass} hint={adminLockedHint} {...adminLockedProps} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="year" label="Año" type="number" inputMode="numeric" defaultValue={vehicle?.year ?? ""} min={1950} max={2100} className={adminLockedClass} hint={adminLockedHint} {...adminLockedProps} />
        <TextField id="color" label="Color" defaultValue={vehicle?.color ?? ""} className={adminLockedClass} hint={adminLockedHint} {...adminLockedProps} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="currentKm" label="Kilometraje actual" type="number" inputMode="numeric" defaultValue={vehicle?.currentKm ?? 0} min={0} />
        <TextField id="nextServiceKm" label="Próximo service (km)" hint="Opcional — alimenta las alertas" type="number" inputMode="numeric" defaultValue={vehicle?.nextServiceKm ?? ""} min={0} />
      </div>
      <TextField id="serviceIntervalKm" label="Intervalo de service (km)" hint="Opcional — al registrar un service, el próximo se reprograma solo (ej. 10000)" type="number" inputMode="numeric" defaultValue={vehicle?.serviceIntervalKm ?? ""} min={0} />
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
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="engineNumber" label="Número de motor" defaultValue={vehicle?.engineNumber ?? ""} className={adminLockedClass} hint={adminLockedHint} {...adminLockedProps} />
        <TextField id="chassisNumber" label="Chasis" defaultValue={vehicle?.chassisNumber ?? ""} className={adminLockedClass} hint={adminLockedHint} {...adminLockedProps} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="insuranceCompany" label="Empresa de seguro" defaultValue={vehicle?.insuranceCompany ?? ""} className={adminLockedClass} hint={adminLockedHint} {...adminLockedProps} />
        <TextField id="insurancePolicyNumber" label="Número de póliza" defaultValue={vehicle?.insurancePolicyNumber ?? ""} className={adminLockedClass} hint={adminLockedHint} {...adminLockedProps} />
      </div>
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
