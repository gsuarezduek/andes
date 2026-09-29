"use client";

import { useState } from "react";
import { TaskRow } from "@/components/tasks/task-row";
import type { TaskRow as TaskRowData } from "@/lib/tasks";

type UserOption = { id: string; name: string };
type VehicleOption = { id: string; name: string | null; brand: string; model: string; plate: string };

type Row = { task: TaskRowData; overdue: boolean; dueToday: boolean; canEdit: boolean };

/**
 * Lista de pendientes con un lock compartido para "Hecha": mientras una fila
 * está enviando su completeTask, el resto queda deshabilitado. Sin esto, un
 * click que tarda en confirmarse invita a un segundo click que — si la
 * lista ya se reordenó porque el primero terminó — cae sobre el botón
 * "Hecha" de OTRA tarea sin querer. `busyTaskId` se resetea solo porque el
 * caller (page.tsx) le pasa una `key` que cambia con el listado de
 * pendientes — al llegar uno nuevo del servidor, React remonta este
 * componente en vez de reusar el viejo estado (evita un useEffect que
 * llame setState, que dispara un re-render en cascada).
 */
export function PendingTaskList({
  tasks,
  users,
  vehicles,
}: {
  tasks: Row[];
  users: UserOption[];
  vehicles: VehicleOption[];
}) {
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  return (
    <ul className="flex flex-col divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
      {tasks.map(({ task, overdue, dueToday, canEdit }) => (
        <TaskRow
          key={`${task.id}-${task.text}-${task.priority}-${task.dueDate?.getTime()}-${task.assignedToId}-${task.vehicleId}-${task.recurrenceId}-${task.recurrence?.freq}-${task.recurrence?.interval}`}
          task={task}
          overdue={overdue}
          dueToday={dueToday}
          canEdit={canEdit}
          users={users}
          vehicles={vehicles}
          completionsLocked={busyTaskId !== null && busyTaskId !== task.id}
          onCompleteSubmit={() => setBusyTaskId(task.id)}
        />
      ))}
    </ul>
  );
}
