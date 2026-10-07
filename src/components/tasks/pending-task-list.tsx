"use client";

import { useMemo, useState } from "react";
import { TaskRow } from "@/components/tasks/task-row";
import { normalizeSearch } from "@/lib/command-palette";
import { groupPendingTasksByUrgency } from "@/lib/task-grouping";
import { vehicleLabelWithPlate } from "@/lib/vehicle-ui";
import type { TaskRow as TaskRowData } from "@/lib/tasks";
import type { RentalPickerOption } from "@/lib/cash";

type UserOption = { id: string; name: string };
type VehicleOption = { id: string; name: string | null; brand: string; model: string; plate: string };

type Row = { task: TaskRowData; overdue: boolean; dueToday: boolean; canEdit: boolean };

function matchesSearch(row: Row, query: string): boolean {
  if (!query) return true;
  const haystack = normalizeSearch(
    [
      row.task.text,
      row.task.assignedToName,
      row.task.vehicle ? vehicleLabelWithPlate(row.task.vehicle) : null,
      row.task.rental?.clientName,
    ]
      .filter(Boolean)
      .join(" "),
  );
  return haystack.includes(query);
}

/**
 * Lista de pendientes agrupada por urgencia (Vencidas / Para hoy / Próximas /
 * Sin fecha, ver groupPendingTasksByUrgency) con buscador de texto libre
 * client-side (no cambia la URL ni vuelve a pedirle nada al servidor — mismo
 * criterio que CashMovementSearch: es un "encontrar esto" rápido sobre lo ya
 * cargado, no reemplaza los filtros de arriba de assignado/vehículo/prioridad).
 *
 * También tiene un lock compartido para "Hecha": mientras una fila está
 * enviando su completeTask, el resto queda deshabilitado. Sin esto, un click
 * que tarda en confirmarse invita a un segundo click que — si la lista ya se
 * reordenó porque el primero terminó — cae sobre el botón "Hecha" de OTRA
 * tarea sin querer. `busyTaskId` se resetea solo porque el caller (page.tsx)
 * le pasa una `key` que cambia con el listado de pendientes — al llegar uno
 * nuevo del servidor, React remonta este componente en vez de reusar el
 * viejo estado (evita un useEffect que llame setState, que dispara un
 * re-render en cascada).
 */
export function PendingTaskList({
  tasks,
  users,
  vehicles,
  rentalOptions,
}: {
  tasks: Row[];
  users: UserOption[];
  vehicles: VehicleOption[];
  rentalOptions: RentalPickerOption[];
}) {
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const query = normalizeSearch(search);
  const filtered = useMemo(() => tasks.filter((row) => matchesSearch(row, query)), [tasks, query]);
  const groups = useMemo(
    () => groupPendingTasksByUrgency(filtered.map((row) => ({ ...row, dueDate: row.task.dueDate }))),
    [filtered],
  );

  return (
    <div className="flex flex-col gap-4">
      {tasks.length > 5 && (
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por texto, asignado o vehículo…"
          aria-label="Buscar tarea pendiente"
          className="h-11 w-full rounded-lg border border-foreground/15 bg-transparent px-3 text-base outline-none focus:border-foreground/40"
        />
      )}
      {query && filtered.length === 0 ? (
        <p className="rounded-lg border border-foreground/10 px-4 py-3 text-sm text-foreground/50">
          Ninguna tarea pendiente coincide con &quot;{search}&quot;.
        </p>
      ) : (
        groups.map((group) => (
          <div key={group.key} className="flex flex-col gap-2">
            <h3
              className={`text-xs font-semibold uppercase tracking-wide ${
                group.key === "overdue" ? "text-red-600" : group.key === "today" ? "text-amber-600" : "text-foreground/50"
              }`}
            >
              {group.label} ({group.tasks.length})
            </h3>
            <ul className="flex flex-col divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
              {group.tasks.map(({ task, overdue, dueToday, canEdit }) => (
                <TaskRow
                  key={`${task.id}-${task.text}-${task.priority}-${task.dueDate?.getTime()}-${task.assignedToId}-${task.vehicleId}-${task.rentalId}-${task.recurrenceId}-${task.recurrence?.freq}-${task.recurrence?.interval}`}
                  task={task}
                  overdue={overdue}
                  dueToday={dueToday}
                  canEdit={canEdit}
                  users={users}
                  vehicles={vehicles}
                  rentalOptions={rentalOptions}
                  completionsLocked={busyTaskId !== null && busyTaskId !== task.id}
                  onCompleteSubmit={() => setBusyTaskId(task.id)}
                />
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}
