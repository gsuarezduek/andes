import { describe, it, expect } from "vitest";
import { groupCompletedTasksByDay } from "@/lib/task-grouping";

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
