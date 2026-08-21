"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { TextField, TextareaField, SelectField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmDeleteCard } from "@/components/ui/confirm-delete-card";
import { EditIcon } from "@/components/ui/icons";
import { formatDate, formatDateInput } from "@/lib/datetime";
import { completeTask, updateTask, deleteTask } from "@/app/(app)/tasks/actions";
import type { TaskRow as TaskRowData } from "@/lib/tasks";

type UserOption = { id: string; name: string };
type VehicleOption = { id: string; brand: string; model: string; plate: string };

/**
 * Fila de una tarea pendiente en /tasks. Tres modos como MovementRow
 * (view/edit/confirmDelete). Cualquiera puede marcarla "Hecha"; solo
 * `canEdit` (creador o admin, calculado por el caller) ve el ícono de editar.
 * El caller debe pasar una `key` que cambie con los datos editables, mismo
 * motivo que MovementRow: forzar remount tras guardar en vez de quedar
 * pegado al `defaultValue` con el que se abrió el form.
 */
export function TaskRow({
  task,
  overdue,
  dueToday,
  canEdit,
  users,
  vehicles,
}: {
  task: TaskRowData;
  overdue: boolean;
  dueToday: boolean;
  canEdit: boolean;
  users: UserOption[];
  vehicles: VehicleOption[];
}) {
  const [mode, setMode] = useState<"view" | "edit" | "confirmDelete">("view");

  if (mode === "confirmDelete") {
    return (
      <ConfirmDeleteCard
        message={<>¿Eliminar la tarea &quot;{task.text}&quot;?</>}
        action={deleteTask.bind(null, task.id)}
        onCancel={() => setMode("edit")}
      />
    );
  }

  if (mode === "edit") {
    return (
      <li className="rounded-lg border border-foreground/15 px-3 py-3 text-sm">
        <form action={updateTask.bind(null, task.id)} className="flex flex-col gap-2">
          <TextareaField id="text" label="Tarea" defaultValue={task.text} required rows={2} />
          <div className="grid grid-cols-2 gap-3">
            <SelectField id="priority" label="Prioridad" defaultValue={task.priority}>
              <option value="normal">Normal</option>
              <option value="high">Alta</option>
            </SelectField>
            <TextField
              id="dueDate"
              label="Fecha"
              type="date"
              defaultValue={task.dueDate ? formatDateInput(task.dueDate) : ""}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SelectField id="assignedToId" label="Asignar a" defaultValue={task.assignedToId ?? ""}>
              <option value="">Sin asignar</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </SelectField>
            <SelectField id="vehicleId" label="Vehículo" defaultValue={task.vehicleId ?? ""}>
              <option value="">Sin vehículo</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.brand} {v.model} · {v.plate}
                </option>
              ))}
            </SelectField>
          </div>
          <div className="mt-1 flex items-center gap-3">
            <button type="button" onClick={() => setMode("view")} className="text-xs text-foreground/50">
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => setMode("confirmDelete")}
              className="text-xs font-medium text-red-600 underline"
            >
              Eliminar
            </button>
            <SubmitButton pendingLabel="Guardando…" className="ml-auto">
              Guardar
            </SubmitButton>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li
      className={`flex items-start justify-between gap-3 px-3 py-2.5 text-sm ${
        overdue ? "border-l-4 border-l-red-500 bg-red-500/5" : dueToday ? "border-l-4 border-l-amber-500 bg-amber-500/5" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className="whitespace-pre-wrap">{task.text}</span>
          {task.priority === "high" && <Badge tone="red">Alta</Badge>}
          {task.dueDate && (
            <Badge tone={overdue ? "red" : dueToday ? "amber" : "neutral"}>{formatDate(task.dueDate)}</Badge>
          )}
        </p>
        <p className="mt-0.5 text-xs text-foreground/50">
          {task.assignedTo ? task.assignedTo.name : "Sin asignar"}
          {" · creada por "}
          {task.createdBy?.name ?? "—"}
          {task.vehicle ? (
            <>
              {" · "}
              <Link href={`/vehicles/${task.vehicle.id}`} className="underline">
                {task.vehicle.brand} {task.vehicle.model} · {task.vehicle.plate}
              </Link>
            </>
          ) : null}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <form action={completeTask.bind(null, task.id)}>
          <button type="submit" className="text-xs font-medium text-emerald-600">
            Hecha
          </button>
        </form>
        {canEdit && (
          <button
            type="button"
            onClick={() => setMode("edit")}
            title="Editar"
            aria-label="Editar"
            className="text-foreground/50 hover:text-foreground/80"
          >
            <EditIcon />
          </button>
        )}
      </div>
    </li>
  );
}
