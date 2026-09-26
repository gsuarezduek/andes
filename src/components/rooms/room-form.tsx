"use client";

import { useActionState } from "react";
import { TextField, TextareaField, FormError } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { ButtonLink } from "@/components/ui/button";
import type { FormState } from "@/app/(app)/rooms/actions";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

export type RoomFormValues = {
  name: string;
  description: string | null;
  capacity: number | null;
  nightlyRate: number | null;
  checkInTime: string;
  checkOutTime: string;
  sortOrder: number | null;
  notes: string | null;
};

export function RoomForm({
  action,
  room,
  cancelHref,
}: {
  action: Action;
  room?: RoomFormValues;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <TextField id="name" label="Nombre" required defaultValue={room?.name} maxLength={80} placeholder="Ej. Habitación 1" />
      <TextareaField id="description" label="Descripción" defaultValue={room?.description ?? ""} hint="Opcional — para el equipo (piso, baño, cómo llegar…)." />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="nightlyRate"
          label="Tarifa por noche"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          prefix="$"
          defaultValue={room?.nightlyRate ?? ""}
          hint="Lo que se cobra al huésped por noche."
        />
        <TextField id="capacity" label="Capacidad" type="number" inputMode="numeric" min={1} defaultValue={room?.capacity ?? ""} hint="Personas (opcional)." />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField id="checkInTime" label="Entrada (check-in)" type="time" defaultValue={room?.checkInTime ?? "14:00"} required />
        <TextField id="checkOutTime" label="Salida (check-out)" type="time" defaultValue={room?.checkOutTime ?? "10:00"} required />
      </div>
      <TextField
        id="sortOrder"
        label="Orden en el calendario"
        type="number"
        inputMode="numeric"
        min={1}
        defaultValue={room?.sortOrder ?? ""}
        hint="Opcional — menor = más arriba."
      />
      <TextareaField id="notes" label="Notas" defaultValue={room?.notes ?? ""} />

      <FormError>{state.error}</FormError>

      <div className="flex gap-3">
        <SubmitButton>{room ? "Guardar cambios" : "Crear habitación"}</SubmitButton>
        <ButtonLink href={cancelHref} variant="secondary">
          Cancelar
        </ButtonLink>
      </div>
    </form>
  );
}
