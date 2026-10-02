import { describe, it, expect } from "vitest";
import { groupCompletedTasksByDay, groupPendingTasksByUrgency } from "@/lib/task-grouping";

// "now" fijo: 17/08/2026 10:00 hora Mendoza (13:00 UTC).
const NOW = new Date("2026-08-17T13:00:00Z");

function task(id: string, isoMendozaWall: string | null) {
  // isoMendozaWall tipo "2026-08-17T13:00" (hora de pared Mendoza, UTC-3).
  return { id, completedAt: isoMendozaWall ? new Date(`${isoMendozaWall}:00-03:00`) : null };
}

describe("groupCompletedTasksByDay", () => {
  it("agrupa el día de hoy bajo la etiqueta 'Hoy'", () => {
    const tasks = [task("a", "2026-08-17T09:00"), task("b", "2026-08-17T15:00")];
    const groups = groupCompletedTasksByDay(tasks, NOW);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ key: "2026-08-17", label: "Hoy" });
    expect(groups[0].tasks.map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("otro día del año actual: 'D de Mes' sin año", () => {
    const tasks = [task("a", "2026-03-30T09:00")];
    const groups = groupCompletedTasksByDay(tasks, NOW);
    expect(groups[0]).toMatchObject({ key: "2026-03-30", label: "30 de Marzo" });
  });

  it("un año distinto al actual suma 'de AAAA'", () => {
    const tasks = [task("a", "2025-03-30T09:00")];
    const groups = groupCompletedTasksByDay(tasks, NOW);
    expect(groups[0]).toMatchObject({ label: "30 de Marzo de 2025" });
  });

  it("mantiene el orden de entrada y separa por día sin reordenar", () => {
    const tasks = [
      task("a", "2026-08-17T09:00"),
      task("b", "2026-08-16T09:00"),
      task("c", "2026-08-17T20:00"),
    ];
    const groups = groupCompletedTasksByDay(tasks, NOW);
    // "c" vuelve a caer en el día 17, pero como no es consecutivo con "a"
    // (se intercaló "b" del día 16), abre un grupo nuevo en vez de unirse al primero.
    expect(groups.map((g) => g.key)).toEqual(["2026-08-17", "2026-08-16", "2026-08-17"]);
    expect(groups[0].tasks.map((t) => t.id)).toEqual(["a"]);
    expect(groups[2].tasks.map((t) => t.id)).toEqual(["c"]);
  });

  it("sin tareas, no genera grupos", () => {
    expect(groupCompletedTasksByDay([], NOW)).toEqual([]);
  });

  it("ignora defensivamente una tarea sin completedAt", () => {
    const tasks = [task("a", "2026-08-17T09:00"), task("b", null)];
    const groups = groupCompletedTasksByDay(tasks, NOW);
    expect(groups[0].tasks.map((t) => t.id)).toEqual(["a"]);
  });
});

function pending(id: string, overdue: boolean, dueToday: boolean, dueDate: Date | null) {
  return { id, overdue, dueToday, dueDate };
}

describe("groupPendingTasksByUrgency", () => {
  it("separa en Vencidas / Para hoy / Próximas / Sin fecha, en ese orden", () => {
    const future = new Date("2026-09-01T00:00:00Z");
    const tasks = [
      pending("noDate", false, false, null),
      pending("upcoming", false, false, future),
      pending("today", false, true, NOW),
      pending("overdue", true, false, new Date("2026-08-01T00:00:00Z")),
    ];
    const groups = groupPendingTasksByUrgency(tasks);
    expect(groups.map((g) => g.key)).toEqual(["overdue", "today", "upcoming", "noDate"]);
    expect(groups.map((g) => g.label)).toEqual(["Vencidas", "Para hoy", "Próximas", "Sin fecha"]);
    expect(groups.map((g) => g.tasks[0].id)).toEqual(["overdue", "today", "upcoming", "noDate"]);
  });

  it("no muestra grupos vacíos", () => {
    const groups = groupPendingTasksByUrgency([pending("a", false, true, NOW)]);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("today");
  });

  it("mantiene el orden de entrada dentro de cada grupo", () => {
    const d1 = new Date("2026-09-01T00:00:00Z");
    const d2 = new Date("2026-09-05T00:00:00Z");
    const tasks = [pending("b", false, false, d2), pending("a", false, false, d1)];
    const groups = groupPendingTasksByUrgency(tasks);
    expect(groups[0].tasks.map((t) => t.id)).toEqual(["b", "a"]);
  });

  it("sin tareas, no genera grupos", () => {
    expect(groupPendingTasksByUrgency([])).toEqual([]);
  });

  it("overdue tiene prioridad sobre dueToday si ambos vinieran en true (defensivo)", () => {
    const groups = groupPendingTasksByUrgency([pending("a", true, true, NOW)]);
    expect(groups[0].key).toBe("overdue");
  });
});
