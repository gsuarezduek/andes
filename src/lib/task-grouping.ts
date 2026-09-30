import { formatDateInput } from "@/lib/datetime";

export type TaskDayGroup<T> = {
  key: string; // "YYYY-MM-DD"
  label: string; // "Hoy" | "30 de Marzo" | "30 de Marzo de 2025"
  tasks: T[];
};

const MONTH_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  month: "long",
  timeZone: "America/Argentina/Mendoza",
});

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Agrupa tareas completadas por día calendario (hora Mendoza) para el
 * historial de /tasks. Asume que ya vienen ordenadas por `completedAt` desc
 * (como devuelve getCompletedTasksPage) — no reordena, solo junta
 * consecutivas del mismo día. "Hoy" para el día de hoy; el resto "D de Mes"
 * (con año si no es el actual).
 */
export function groupCompletedTasksByDay<T extends { completedAt: Date | null }>(
  tasks: T[],
  now: Date,
): TaskDayGroup<T>[] {
  const todayKey = formatDateInput(now);
  const currentYear = todayKey.slice(0, 4);

  const groups: TaskDayGroup<T>[] = [];
  for (const task of tasks) {
    if (!task.completedAt) continue; // defensivo: siempre debería tener fecha si status=done
    const dayKey = formatDateInput(task.completedAt);
    const last = groups[groups.length - 1];
    const group =
      last?.key === dayKey
        ? last
        : (() => {
            const dayNumber = Number(dayKey.slice(8, 10));
            const year = dayKey.slice(0, 4);
            const monthLabel = capitalize(MONTH_FORMATTER.format(task.completedAt!));
            const label =
              dayKey === todayKey
                ? "Hoy"
                : `${dayNumber} de ${monthLabel}${year === currentYear ? "" : ` de ${year}`}`;
            const g: TaskDayGroup<T> = { key: dayKey, label, tasks: [] };
            groups.push(g);
            return g;
          })();
    group.tasks.push(task);
  }
  return groups;
}

export type PendingTaskBucketKey = "overdue" | "today" | "upcoming" | "noDate";

export type PendingTaskGroup<T> = {
  key: PendingTaskBucketKey;
  label: string;
  tasks: T[];
};

const PENDING_BUCKET_LABELS: Record<PendingTaskBucketKey, string> = {
  overdue: "Vencidas",
  today: "Para hoy",
  upcoming: "Próximas",
  noDate: "Sin fecha",
};

/**
 * Agrupa tareas pendientes por urgencia para /tasks: Vencidas / Para hoy /
 * Próximas / Sin fecha. No calcula `overdue`/`dueToday` — los recibe ya
 * resueltos (isTaskOverdue/isTaskDueToday), así da igual llamarla desde el
 * servidor o desde un componente cliente, sin depender de a qué hora exacta
 * corre cada lado. Conserva el orden de entrada dentro de cada grupo (ya
 * viene ordenado por fecha desde getPendingTasks); los grupos vacíos no
 * aparecen.
 */
export function groupPendingTasksByUrgency<
  T extends { overdue: boolean; dueToday: boolean; dueDate: Date | null },
>(tasks: T[]): PendingTaskGroup<T>[] {
  const buckets: Record<PendingTaskBucketKey, T[]> = { overdue: [], today: [], upcoming: [], noDate: [] };
  for (const task of tasks) {
    if (task.overdue) buckets.overdue.push(task);
    else if (task.dueToday) buckets.today.push(task);
    else if (task.dueDate) buckets.upcoming.push(task);
    else buckets.noDate.push(task);
  }
  return (["overdue", "today", "upcoming", "noDate"] as const)
    .map((key) => ({ key, label: PENDING_BUCKET_LABELS[key], tasks: buckets[key] }))
    .filter((g) => g.tasks.length > 0);
}
