import "server-only";
import type { Prisma, Task } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatDateInput, mendozaWallTimeToUtc } from "@/lib/datetime";

const ROW_INCLUDE = {
  vehicle: { select: { id: true, name: true, brand: true, model: true, plate: true } },
  assignedTo: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
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
 * Resumen para el home: solo tareas asignadas a mí. No entran las sin asignar
 * ni las de otros, aunque venzan hoy — la notificación es personal, no una
 * vista de coordinación (para eso está /tasks con todas las pendientes).
 */
export async function getHomeTasks(userId: string): Promise<TaskRow[]> {
  return prisma.task.findMany({
    where: { status: "pending", assignedToId: userId },
    include: ROW_INCLUDE,
    orderBy: ORDER_BY,
  });
}

export type TaskFilters = {
  assignedToId?: string;
  vehicleId?: string;
  priority?: "normal" | "high";
};

/** Listado completo de pendientes para /tasks, con filtros opcionales. */
export async function getPendingTasks(filters: TaskFilters): Promise<TaskRow[]> {
  return prisma.task.findMany({
    where: {
      status: "pending",
      assignedToId: filters.assignedToId || undefined,
      vehicleId: filters.vehicleId || undefined,
      priority: filters.priority || undefined,
    },
    include: ROW_INCLUDE,
    orderBy: ORDER_BY,
  });
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
  return prisma.task.count({ where: { assignedToId: userId, status: "pending" } });
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
