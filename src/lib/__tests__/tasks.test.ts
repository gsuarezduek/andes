import { describe, it, expect, vi } from "vitest";

// tasks.ts importa prisma; lo mockeamos para testear los helpers puros sin
// instanciar el cliente (mismo criterio que reports.test.ts).
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { isTaskOverdue, isTaskDueToday } from "@/lib/tasks";
import { mendozaWallTimeToUtc } from "@/lib/datetime";

// "Ahora" fijo: 2026-08-17 12:00 en Mendoza (15:00 UTC).
const now = new Date("2026-08-17T15:00:00.000Z");
const yesterday = mendozaWallTimeToUtc("2026-08-16T00:00");
const today = mendozaWallTimeToUtc("2026-08-17T00:00");
const tomorrow = mendozaWallTimeToUtc("2026-08-18T00:00");

describe("isTaskOverdue", () => {
  it("es true si la fecha ya pasó y sigue pendiente", () => {
    expect(isTaskOverdue({ status: "pending", dueDate: yesterday }, now)).toBe(true);
  });

  it("es false si vence hoy (no es 'vencida', es 'de hoy')", () => {
    expect(isTaskOverdue({ status: "pending", dueDate: today }, now)).toBe(false);
  });

  it("es false si vence a futuro", () => {
    expect(isTaskOverdue({ status: "pending", dueDate: tomorrow }, now)).toBe(false);
  });

  it("es false si ya está hecha, aunque la fecha haya pasado", () => {
    expect(isTaskOverdue({ status: "done", dueDate: yesterday }, now)).toBe(false);
  });

  it("es false sin fecha", () => {
    expect(isTaskOverdue({ status: "pending", dueDate: null }, now)).toBe(false);
  });
});

describe("isTaskDueToday", () => {
  it("es true si la fecha cae dentro de hoy", () => {
    expect(isTaskDueToday({ status: "pending", dueDate: today }, now)).toBe(true);
  });

  it("es false si ya venció (ayer)", () => {
    expect(isTaskDueToday({ status: "pending", dueDate: yesterday }, now)).toBe(false);
  });

  it("es false si vence mañana", () => {
    expect(isTaskDueToday({ status: "pending", dueDate: tomorrow }, now)).toBe(false);
  });

  it("es false si ya está hecha", () => {
    expect(isTaskDueToday({ status: "done", dueDate: today }, now)).toBe(false);
  });

  it("es false sin fecha", () => {
    expect(isTaskDueToday({ status: "pending", dueDate: null }, now)).toBe(false);
  });
});
