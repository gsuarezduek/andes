import "server-only";
import type { Prisma, Task } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatDateInput, mendozaWallTimeToUtc } from "@/lib/datetime";
import { recurringVisibilityCutoff } from "@/lib/task-recurrence";

const ROW_INCLUDE = {
  vehicle: { select: { id: true, name: true, brand: true, model: true, plate: true } },
  rental: { select: { id: true, clientName: true } },
  recurrence: { select: { freq: true, interval: true, weekday: true, dayOfMonth: true, month: true, active: true } },
} satisfies Prisma.TaskInclude;

export type TaskRow = Prisma.TaskGetPayload<{ include: typeof ROW_INCLUDE }>;

const ORDER_BY: Prisma.TaskOrderByWithRelationInput[] = [
  { dueDate: { sort: "asc", nulls: "last" } },
  { createdAt: "asc" },
];

/** Medianoche de hoy y de mañana en Mendoza, como instantes UTC — misma cuenta que dashboard.ts. */
function todayWindow(now: Date) {
  const todayStr = formatDateInput(now);
  const dayStart = mendozaWallTimeToUtc(`${todayStr}T00:00`);
  const tomorrowStart = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  return { dayStart, tomorrowStart };
}

/**
 * Pendientes que se muestran: todo, salvo las ocurrencias de una tarea
 * recurrente cuya fecha todavía no entró en la ventana de visibilidad (aparecen
 * el día antes, ver recurringVisibilityCutoff). Esas quedan "programadas".
 */
function visibleWhere(now = new Date()): Prisma.TaskWhereInput {
  return {
    OR: [{ recurrenceId: null }, { dueDate: null }, { dueDate: { lt: recurringVisibilityCutoff(now) } }],
  };
}

/**
 * Resumen para el home: solo tareas asignadas a mí. No entran las sin asignar
 * ni las de otros, aunque venzan hoy — la notificación es personal, no una
 * vista de coordinación (para eso está /tasks con todas las pendientes).
 */
export async function getHomeTasks(userId: string): Promise<TaskRow[]> {
  return prisma.task.findMany({
    where: { status: "pending", assignedToId: userId, ...visibleWhere() },
    include: ROW_INCLUDE,
    orderBy: ORDER_BY,
  });
}

export type TaskFilters = {
  assignedToId?: string;
  vehicleId?: string;
  priority?: "normal" | "high";
};

function filtersWhere(filters: TaskFilters): Prisma.TaskWhereInput {
  return {
    status: "pending",
    assignedToId: filters.assignedToId || undefined,
    vehicleId: filters.vehicleId || undefined,
    priority: filters.priority || undefined,
  };
}

/** Listado completo de pendientes para /tasks, con filtros opcionales (sin las recurrentes programadas). */
export async function getPendingTasks(filters: TaskFilters): Promise<TaskRow[]> {
  return prisma.task.findMany({
    where: { ...filtersWhere(filters), ...visibleWhere() },
    include: ROW_INCLUDE,
    orderBy: ORDER_BY,
  });
}

/**
 * Próximas ocurrencias de tareas recurrentes que todavía no aparecen como
 * pendientes — se listan aparte (plegadas) en /tasks para poder editarlas o
 * borrarlas antes de que llegue su día.
 */
export async function getScheduledRecurringTasks(filters: TaskFilters): Promise<TaskRow[]> {
  return prisma.task.findMany({
    where: {
      ...filtersWhere(filters),
      recurrenceId: { not: null },
      dueDate: { gte: recurringVisibilityCutoff(new Date()) },
    },
    include: ROW_INCLUDE,
    orderBy: ORDER_BY,
  });
}

/** Total de pendientes visibles de todo el equipo — para la pestaña "Todas". */
export async function getVisiblePendingCount(): Promise<number> {
  return prisma.task.count({ where: { status: "pending", ...visibleWhere() } });
}

const COMPLETED_PAGE_SIZE = 20;

export type CompletedTasksPage = {
  items: TaskRow[];
  total: number;
  page: number;
  totalPages: number;
};

/** Historial paginado de tareas terminadas (puede crecer indefinidamente). */
export async function getCompletedTasksPage(page: number): Promise<CompletedTasksPage> {
  const [items, total] = await Promise.all([
    prisma.task.findMany({
      where: { status: "done" },
      include: ROW_INCLUDE,
      orderBy: { completedAt: "desc" },
      skip: (page - 1) * COMPLETED_PAGE_SIZE,
      take: COMPLETED_PAGE_SIZE,
    }),
    prisma.task.count({ where: { status: "done" } }),
  ]);
  return { items, total, page, totalPages: Math.max(1, Math.ceil(total / COMPLETED_PAGE_SIZE)) };
}

/** Cuántas tareas pendientes tiene asignadas un usuario — para el contador del nav. */
export async function getAssignedPendingCount(userId: string): Promise<number> {
  return prisma.task.count({ where: { assignedToId: userId, status: "pending", ...visibleWhere() } });
}

type TaskDueFields = Pick<Task, "dueDate" | "status">;

/** Vencida: tenía fecha, sigue pendiente, y esa fecha ya pasó (antes de hoy). */
export function isTaskOverdue(task: TaskDueFields, now = new Date()): boolean {
  if (task.status !== "pending" || !task.dueDate) return false;
  const { dayStart } = todayWindow(now);
  return task.dueDate < dayStart;
}

/** Vence hoy: tenía fecha, sigue pendiente, y esa fecha cae dentro de hoy. */
export function isTaskDueToday(task: TaskDueFields, now = new Date()): boolean {
  if (task.status !== "pending" || !task.dueDate) return false;
  const { dayStart, tomorrowStart } = todayWindow(now);
  return task.dueDate >= dayStart && task.dueDate < tomorrowStart;
}
