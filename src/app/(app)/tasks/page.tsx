import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { compactControlClass } from "@/components/ui/fields";
import { TaskForm } from "@/components/tasks/task-form";
import { TaskRow } from "@/components/tasks/task-row";
import { getPendingTasks, getCompletedTasksPage, isTaskOverdue, isTaskDueToday, type TaskFilters } from "@/lib/tasks";
import { groupCompletedTasksByDay } from "@/lib/task-grouping";

export const metadata: Metadata = { title: "Tareas — Andes" };

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ assignedTo?: string; vehicle?: string; priority?: string; cp?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const isAdmin = user.role === "admin";

  const filters: TaskFilters = {
    assignedToId: sp.assignedTo,
    vehicleId: sp.vehicle,
    priority: sp.priority === "high" ? "high" : sp.priority === "normal" ? "normal" : undefined,
  };
  const completedPage = Math.max(1, Number(sp.cp) || 1);

  const [pending, completed, users, vehicles] = await Promise.all([
    getPendingTasks(filters),
    getCompletedTasksPage(completedPage),
    prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.vehicle.findMany({
      where: { archivedAt: null },
      orderBy: [{ brand: "asc" }, { model: "asc" }],
      select: { id: true, brand: true, model: true, plate: true },
    }),
  ]);

  const hasFilters = Boolean(filters.assignedToId || filters.vehicleId || filters.priority);
  const completedGroups = groupCompletedTasksByDay(completed.items, new Date());

  // Preserva los filtros vigentes al cambiar de página del historial.
  const completedPageHref = (page: number) => {
    const params = new URLSearchParams();
    if (filters.assignedToId) params.set("assignedTo", filters.assignedToId);
    if (filters.vehicleId) params.set("vehicle", filters.vehicleId);
    if (filters.priority) params.set("priority", filters.priority);
    if (page > 1) params.set("cp", String(page));
    const qs = params.toString();
    return qs ? `/tasks?${qs}#historial` : "/tasks#historial";
  };

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tareas</h1>
        <p className="text-sm text-foreground/60">Coordinación del equipo: lavados, trámites, compras y demás.</p>
      </div>

      <TaskForm users={users} vehicles={vehicles} />

      <div className="flex flex-wrap items-center gap-2">
        <form className="flex flex-wrap items-center gap-2">
          <select name="assignedTo" defaultValue={filters.assignedToId ?? ""} className={compactControlClass}>
            <option value="">Todos los asignados</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <select name="vehicle" defaultValue={filters.vehicleId ?? ""} className={compactControlClass}>
            <option value="">Todos los vehículos</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.brand} {v.model} · {v.plate}
              </option>
            ))}
          </select>
          <select name="priority" defaultValue={filters.priority ?? ""} className={compactControlClass}>
            <option value="">Toda prioridad</option>
            <option value="normal">Normal</option>
            <option value="high">Alta</option>
          </select>
          <button className="h-10 rounded-lg border border-foreground/15 px-4 text-sm font-medium">Filtrar</button>
          {hasFilters ? (
            <Link href="/tasks" className="text-xs font-medium text-foreground/60 underline">
              Limpiar
            </Link>
          ) : null}
        </form>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
          Pendientes{pending.length > 0 ? ` (${pending.length})` : ""}
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-lg border border-foreground/10 px-4 py-3 text-sm text-foreground/50">
            No hay tareas pendientes.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
            {pending.map((task) => {
              const overdue = isTaskOverdue(task);
              const dueToday = isTaskDueToday(task);
              const canEdit = isAdmin || task.createdById === user.id;
              return (
                <TaskRow
                  key={`${task.id}-${task.text}-${task.priority}-${task.dueDate?.getTime()}-${task.assignedToId}-${task.vehicleId}`}
                  task={task}
                  overdue={overdue}
                  dueToday={dueToday}
                  canEdit={canEdit}
                  users={users}
                  vehicles={vehicles}
                />
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <details>
          <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-foreground/60">
            Historial de completadas{completed.total > 0 ? ` (${completed.total})` : ""}
          </summary>
          <div id="historial" className="mt-3 flex scroll-mt-4 flex-col gap-4">
            {completed.items.length === 0 ? (
              <p className="rounded-lg border border-foreground/10 px-4 py-3 text-sm text-foreground/50">
                Todavía no se completó ninguna tarea.
              </p>
            ) : (
              completedGroups.map((group) => (
                <div key={group.key} className="flex flex-col gap-2">
                  <h3 className="text-xs font-semibold text-foreground/50">{group.label}</h3>
                  <ul className="flex flex-col divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
                    {group.tasks.map((task) => (
                      <li key={task.id} className="px-3 py-2.5 text-sm">
                        <p className="text-foreground/70 line-through decoration-foreground/30">{task.text}</p>
                        <p className="mt-0.5 text-xs text-foreground/50">
                          {task.assignedTo ? task.assignedTo.name : "Sin asignar"}
                          {" · creada por "}
                          {task.createdBy?.name ?? "—"}
                          {task.vehicle ? ` · ${task.vehicle.brand} ${task.vehicle.model} · ${task.vehicle.plate}` : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
            {completed.totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 py-1 text-sm">
                {completedPage > 1 ? (
                  <Link href={completedPageHref(completedPage - 1)} className="font-medium text-foreground/70 underline">
                    ← Anterior
                  </Link>
                ) : (
                  <span className="text-foreground/30">← Anterior</span>
                )}
                <span className="text-xs text-foreground/50">
                  Página {completedPage} de {completed.totalPages}
                </span>
                {completedPage < completed.totalPages ? (
                  <Link href={completedPageHref(completedPage + 1)} className="font-medium text-foreground/70 underline">
                    Siguiente →
                  </Link>
                ) : (
                  <span className="text-foreground/30">Siguiente →</span>
                )}
              </div>
            )}
          </div>
        </details>
      </section>
    </div>
  );
}
