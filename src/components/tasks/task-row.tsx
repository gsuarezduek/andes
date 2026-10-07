"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { TextField, TextareaField, SelectField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmDeleteCard } from "@/components/ui/confirm-delete-card";
import { EditIcon } from "@/components/ui/icons";
import { formatDate, formatDateTime, formatDateInput } from "@/lib/datetime";
import { completeTask, updateTask, deleteTask } from "@/app/(app)/tasks/actions";
import { vehicleLabelWithPlate } from "@/lib/vehicle-ui";
import type { TaskRow as TaskRowData } from "@/lib/tasks";
import { describeRecurrence } from "@/lib/task-recurrence";
import { RentalPicker } from "@/components/cash/rental-picker";
import type { RentalPickerOption } from "@/lib/cash";
import {
  RECURRENCE_INTERVAL_UNIT,
  RECURRENCE_OPTIONS,
  type RecurrenceFormFreq,
} from "@/components/tasks/recurrence-options";

type UserOption = { id: string; name: string };
type VehicleOption = { id: string; name: string | null; brand: string; model: string; plate: string };

/** Botón "Hecha": se deshabilita solo mientras SU form envía (useFormStatus,
 * no puede vivir en el mismo componente que declara el <form>) y también
 * cuando `locked` (otra fila de la misma lista está enviando la suya). */
function HechaButton({ locked }: { locked: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || locked}
      className="text-xs font-medium text-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {pending ? "Marcando…" : "Hecha"}
    </button>
  );
}

/**
 * Fila de una tarea pendiente en /tasks. Tres modos como MovementRow
 * (view/edit/confirmDelete). Cualquiera puede marcarla "Hecha"; solo
 * `canEdit` (creador o admin, calculado por el caller) ve el ícono de editar.
 * El caller debe pasar una `key` que cambie con los datos editables —
 * incluida la regla de recurrencia (freq/interval), no solo los campos
 * "de siempre" — mismo motivo que MovementRow: forzar remount tras guardar
 * en vez de quedar pegado al `defaultValue`/`value` con el que se abrió el
 * form (sin remount, un guardado que solo cambia la regla deja el form de
 * edición abierto con el select/radio visualmente reseteados por el reset
 * automático de `<form action>` de React 19 tras un submit exitoso).
 */
export function TaskRow({
  task,
  overdue,
  dueToday,
  canEdit,
  users,
  vehicles,
  rentalOptions,
  completionsLocked = false,
  onCompleteSubmit,
}: {
  task: TaskRowData;
  overdue: boolean;
  dueToday: boolean;
  canEdit: boolean;
  users: UserOption[];
  vehicles: VehicleOption[];
  rentalOptions: RentalPickerOption[];
  /** true si otra fila de la lista ya está enviando su "Hecha". */
  completionsLocked?: boolean;
  onCompleteSubmit?: () => void;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "confirmDelete">("view");
  const [scope, setScope] = useState<"instance" | "series">("instance");
  const [editFreq, setEditFreq] = useState<RecurrenceFormFreq>(task.recurrence?.freq ?? "daily");

  if (mode === "confirmDelete") {
    return (
      <ConfirmDeleteCard
        message={<>¿Eliminar la tarea &quot;{task.text}&quot;?</>}
        action={deleteTask.bind(null, task.id)}
        onCancel={() => setMode("edit")}
      >
        {task.recurrenceId && (
          <label className="flex items-center gap-2 text-xs text-foreground/70">
            <input type="checkbox" name="stopSeries" className="h-4 w-4" />
            Detener la repetición (no generar más ocurrencias)
          </label>
        )}
      </ConfirmDeleteCard>
    );
  }

  if (mode === "edit") {
    return (
      <li className="rounded-lg border border-foreground/15 px-3 py-3 text-sm">
        <form action={updateTask.bind(null, task.id)} className="flex flex-col gap-2">
          <input type="hidden" name="scope" value={scope} />
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
                  {vehicleLabelWithPlate(v)}
                </option>
              ))}
            </SelectField>
          </div>
          <RentalPicker
            options={rentalOptions}
            initial={task.rental ? { id: task.rental.id, clientName: task.rental.clientName, bookingId: null, plate: null, vehicleName: null, label: task.rental.clientName } : null}
          />
          {task.recurrenceId && task.recurrence && (
            <div className="flex flex-col gap-2 rounded-lg border border-foreground/10 bg-foreground/[0.03] p-2.5">
              <p className="text-xs font-medium text-foreground/70">{describeRecurrence(task.recurrence)}</p>
              <fieldset className="flex flex-col gap-1 text-xs text-foreground/70">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={scope === "instance"}
                    onChange={() => setScope("instance")}
                    className="h-4 w-4"
                  />
                  Esta tarea nada más
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={scope === "series"}
                    onChange={() => setScope("series")}
                    className="h-4 w-4"
                  />
                  Esta y las futuras (toda la serie)
                </label>
              </fieldset>
              {scope === "series" && (
                <div className="grid grid-cols-2 gap-3">
                  <SelectField
                    id="recurrenceFreq"
                    label="Repetir"
                    value={editFreq}
                    onChange={(e) => setEditFreq(e.target.value as RecurrenceFormFreq)}
                  >
                    {RECURRENCE_OPTIONS.filter((o) => o.value !== "none").map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </SelectField>
                  <TextField
                    id="recurrenceInterval"
                    label={`Cada (${RECURRENCE_INTERVAL_UNIT(editFreq)})`}
                    type="number"
                    min={1}
                    max={365}
                    defaultValue={task.recurrence.interval}
                  />
                </div>
              )}
            </div>
          )}
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
      id={`task-${task.id}`}
      className={`flex scroll-mt-4 items-start justify-between gap-3 px-3 py-2.5 text-sm [&:target]:ring-2 [&:target]:ring-inset [&:target]:ring-blue-500/50 ${
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
          {task.recurrenceId && task.recurrence?.active && (
            <span title={describeRecurrence(task.recurrence)} aria-label="Tarea recurrente">
              🔁
            </span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-foreground/50">
          {task.assignedToName ?? "Sin asignar"}
          {" · creada por "}
          {task.createdByName}
          {" el "}
          {formatDateTime(task.createdAt)}
          {task.vehicle ? (
            <>
              {" · "}
              <Link href={`/vehicles/${task.vehicle.id}`} className="underline">
                {vehicleLabelWithPlate(task.vehicle)}
              </Link>
            </>
          ) : null}
          {task.rental ? (
            <>
              {" · "}
              <Link href={`/rentals/${task.rental.id}`} className="underline">
                {task.rental.clientName}
              </Link>
            </>
          ) : null}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <form action={completeTask.bind(null, task.id)} onSubmit={onCompleteSubmit}>
          <HechaButton locked={completionsLocked} />
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
