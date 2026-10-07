"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { completeTask } from "@/app/(app)/tasks/actions";
import { formatDate } from "@/lib/datetime";
import { vehicleLabelWithPlate } from "@/lib/vehicle-ui";
import { describeRecurrence } from "@/lib/task-recurrence";
import type { TaskRow } from "@/lib/tasks";

type Row = { task: TaskRow; overdue: boolean; dueToday: boolean };

/** Mismo botón/lock que PendingTaskList (src/components/tasks) — evita que
 * un click que tarda termine completando la tarea de al lado. */
function HechaButton({ locked }: { locked: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || locked}
      className="shrink-0 text-xs font-medium text-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {pending ? "Marcando…" : "Hecha"}
    </button>
  );
}

/**
 * Tareas del Home: el texto lleva a esa tarea puntual en /tasks (ancla
 * `#task-{id}`, resaltada ahí con `:target`); "Hecha" la completa sin salir
 * del Home. El caller pasa una `key` que cambie con la lista (mismo motivo
 * que PendingTaskList: forzar remount para soltar el lock tras completar,
 * sin un useEffect que dispare un re-render en cascada).
 */
export function HomeTaskList({ tasks }: { tasks: Row[] }) {
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  return (
    <div className="divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
      {tasks.map(({ task, overdue, dueToday }) => (
        <div
          key={task.id}
          className={`flex items-center gap-3 px-4 py-3 ${
            overdue ? "border-l-4 border-l-red-500" : dueToday ? "border-l-4 border-l-amber-500" : "border-l-4 border-l-transparent"
          }`}
        >
          <Link href={`/tasks#task-${task.id}`} className="min-w-0 flex-1 transition-colors hover:opacity-70">
            <p className="flex flex-wrap items-center gap-2 font-medium">
              {task.text}
              {task.priority === "high" ? <Badge tone="red">Alta</Badge> : null}
              {task.recurrenceId && task.recurrence?.active ? (
                <span title={describeRecurrence(task.recurrence)} aria-label="Tarea recurrente">
                  🔁
                </span>
              ) : null}
            </p>
            <p className="text-sm text-foreground/60">
              {task.assignedToName ?? "Sin asignar"}
              {task.vehicle ? ` · ${vehicleLabelWithPlate(task.vehicle)}` : ""}
              {task.rental ? ` · ${task.rental.clientName}` : ""}
            </p>
          </Link>
          {task.dueDate ? (
            <Badge tone={overdue ? "red" : dueToday ? "amber" : "neutral"}>{formatDate(task.dueDate)}</Badge>
          ) : null}
          <form action={completeTask.bind(null, task.id)} onSubmit={() => setBusyTaskId(task.id)}>
            <HechaButton locked={busyTaskId !== null && busyTaskId !== task.id} />
          </form>
        </div>
      ))}
    </div>
  );
}
