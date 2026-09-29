"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextField, TextareaField, SelectField } from "@/components/ui/fields";
import { createTask } from "@/app/(app)/tasks/actions";
import { vehicleLabelWithPlate } from "@/lib/vehicle-ui";
import {
  RECURRENCE_INTERVAL_UNIT,
  RECURRENCE_OPTIONS,
  type RecurrenceFormFreq,
} from "@/components/tasks/recurrence-options";

type UserOption = { id: string; name: string };
type VehicleOption = { id: string; name: string | null; brand: string; model: string; plate: string };

/** Form de alta, colapsado detrás de "+ Nueva tarea" (mismo criterio que MovementLauncher en Caja). */
export function TaskForm({
  users,
  vehicles,
  currentUserId,
}: {
  users: UserOption[];
  vehicles: VehicleOption[];
  currentUserId: string;
}) {
  const [open, setOpen] = useState(false);
  const [recurrenceFreq, setRecurrenceFreq] = useState<RecurrenceFormFreq>("none");

  if (!open) {
    return (
      <Button
        type="button"
        onClick={() => {
          setOpen(true);
          // Sin esto, "Repetir" queda en lo que se eligió la última vez que
          // se abrió el panel — y con eso, "Fecha" queda marcada obligatoria
          // sin que se note por qué en una tarea nueva sin repetición.
          setRecurrenceFreq("none");
        }}
      >
        + Nueva tarea
      </Button>
    );
  }

  return (
    <form action={createTask} className="flex flex-col gap-3 rounded-xl border border-foreground/10 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Nueva tarea</h2>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-foreground/50">
          Cancelar
        </button>
      </div>
      <TextareaField id="text" label="Tarea" required rows={2} placeholder="Ej: lavar el auto, comprar tal cosa…" />
      <div className="grid grid-cols-2 gap-3">
        <SelectField id="priority" label="Prioridad" defaultValue="normal">
          <option value="normal">Normal</option>
          <option value="high">Alta</option>
        </SelectField>
        <TextField
          id="dueDate"
          label="Fecha"
          type="date"
          hint={recurrenceFreq === "none" ? "Opcional" : "Obligatoria para poder repetir"}
          required={recurrenceFreq !== "none"}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          id="recurrenceFreq"
          label="Repetir"
          value={recurrenceFreq}
          onChange={(e) => setRecurrenceFreq(e.target.value as RecurrenceFormFreq)}
        >
          {RECURRENCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </SelectField>
        {recurrenceFreq !== "none" && (
          <TextField
            id="recurrenceInterval"
            label={`Cada (${RECURRENCE_INTERVAL_UNIT(recurrenceFreq)})`}
            type="number"
            min={1}
            max={365}
            defaultValue={1}
          />
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SelectField id="assignedToId" label="Asignar a" defaultValue="">
          {users.some((u) => u.id === currentUserId) ? <option value={currentUserId}>Yo</option> : null}
          <option value="">Sin asignar</option>
          {users
            .filter((u) => u.id !== currentUserId)
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
        </SelectField>
        <SelectField id="vehicleId" label="Vehículo" defaultValue="">
          <option value="">Sin vehículo</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {vehicleLabelWithPlate(v)}
            </option>
          ))}
        </SelectField>
      </div>
      <SubmitButton pendingLabel="Guardando…">Agregar tarea</SubmitButton>
    </form>
  );
}
