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
