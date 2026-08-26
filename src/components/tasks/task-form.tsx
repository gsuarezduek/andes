"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextField, TextareaField, SelectField } from "@/components/ui/fields";
import { createTask } from "@/app/(app)/tasks/actions";
import { vehicleLabelWithPlate } from "@/lib/vehicle-ui";

type UserOption = { id: string; name: string };
type VehicleOption = { id: string; name: string | null; brand: string; model: string; plate: string };

/** Form de alta, colapsado detrás de "+ Nueva tarea" (mismo criterio que MovementLauncher en Caja). */
export function TaskForm({ users, vehicles }: { users: UserOption[]; vehicles: VehicleOption[] }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
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
        <TextField id="dueDate" label="Fecha" type="date" hint="Opcional" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SelectField id="assignedToId" label="Asignar a" defaultValue="">
          <option value="">Sin asignar</option>
          {users.map((u) => (
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
