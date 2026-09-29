import { describe, it, expect } from "vitest";
import { computeNextDueDate, describeRecurrence, ruleFromDueDate, type RecurrenceRule } from "@/lib/task-recurrence";
import { mendozaWallTimeToUtc } from "@/lib/datetime";

const d = (s: string) => mendozaWallTimeToUtc(`${s}T00:00`);

function rule(partial: Partial<RecurrenceRule> & Pick<RecurrenceRule, "freq" | "interval">): RecurrenceRule {
  return { weekday: null, dayOfMonth: null, month: null, ...partial };
}

describe("computeNextDueDate", () => {
  it("daily: suma el intervalo en días", () => {
    const next = computeNextDueDate(rule({ freq: "daily", interval: 1 }), d("2026-09-10"));
    expect(next.getTime()).toBe(d("2026-09-11").getTime());
  });

  it("daily: intervalo > 1", () => {
    const next = computeNextDueDate(rule({ freq: "daily", interval: 5 }), d("2026-09-10"));
    expect(next.getTime()).toBe(d("2026-09-15").getTime());
  });

  it("weekly: suma una semana (mismo día de la semana)", () => {
    const next = computeNextDueDate(rule({ freq: "weekly", interval: 1, weekday: 4 }), d("2026-09-10"));
    expect(next.getTime()).toBe(d("2026-09-17").getTime());
  });

  it("weekly: intervalo de 2 semanas", () => {
    const next = computeNextDueDate(rule({ freq: "weekly", interval: 2, weekday: 4 }), d("2026-09-10"));
    expect(next.getTime()).toBe(d("2026-09-24").getTime());
  });

  it("monthly: conserva el día del mes", () => {
    const next = computeNextDueDate(rule({ freq: "monthly", interval: 1, dayOfMonth: 5 }), d("2026-01-05"));
    expect(next.getTime()).toBe(d("2026-02-05").getTime());
  });

  it("monthly: recorta al último día si el mes siguiente es más corto (31 → 28, no bisiesto)", () => {
    const next = computeNextDueDate(rule({ freq: "monthly", interval: 1, dayOfMonth: 31 }), d("2026-01-31"));
    expect(next.getTime()).toBe(d("2026-02-28").getTime());
  });

  it("monthly: cruza el año con intervalo > 1", () => {
    const next = computeNextDueDate(rule({ freq: "monthly", interval: 3, dayOfMonth: 15 }), d("2026-11-15"));
    expect(next.getTime()).toBe(d("2027-02-15").getTime());
  });

  it("yearly: conserva mes y día", () => {
    const next = computeNextDueDate(rule({ freq: "yearly", interval: 1, dayOfMonth: 20, month: 3 }), d("2026-03-20"));
    expect(next.getTime()).toBe(d("2027-03-20").getTime());
  });

  it("yearly: recorta 29/2 en año no bisiesto", () => {
    // 2028 es bisiesto; 2029 no.
    const next = computeNextDueDate(rule({ freq: "yearly", interval: 1, dayOfMonth: 29, month: 2 }), d("2028-02-29"));
    expect(next.getTime()).toBe(d("2029-02-28").getTime());
  });
});

describe("ruleFromDueDate", () => {
  it("weekly: deriva el día de la semana de la fecha", () => {
    // 2026-09-10 es jueves.
    const r = ruleFromDueDate("weekly", 1, d("2026-09-10"));
    expect(r).toEqual({ freq: "weekly", interval: 1, weekday: 4, dayOfMonth: null, month: null });
  });

  it("monthly: deriva el día del mes", () => {
    const r = ruleFromDueDate("monthly", 2, d("2026-09-10"));
    expect(r).toEqual({ freq: "monthly", interval: 2, weekday: null, dayOfMonth: 10, month: null });
  });

  it("yearly: deriva mes y día", () => {
    const r = ruleFromDueDate("yearly", 1, d("2026-09-10"));
    expect(r).toEqual({ freq: "yearly", interval: 1, weekday: null, dayOfMonth: 10, month: 9 });
  });

  it("daily: no deriva ningún campo extra", () => {
    const r = ruleFromDueDate("daily", 3, d("2026-09-10"));
    expect(r).toEqual({ freq: "daily", interval: 3, weekday: null, dayOfMonth: null, month: null });
  });
});

describe("describeRecurrence", () => {
  it("daily, intervalo 1", () => {
    expect(describeRecurrence(rule({ freq: "daily", interval: 1 }))).toBe("Se repite todos los días");
  });

  it("daily, intervalo > 1", () => {
    expect(describeRecurrence(rule({ freq: "daily", interval: 3 }))).toBe("Se repite cada 3 días");
  });

  it("weekly con día", () => {
    expect(describeRecurrence(rule({ freq: "weekly", interval: 1, weekday: 1 }))).toBe("Se repite cada semana los lunes");
  });

  it("weekly con intervalo > 1", () => {
    expect(describeRecurrence(rule({ freq: "weekly", interval: 2, weekday: 4 }))).toBe(
      "Se repite cada 2 semanas los jueves",
    );
  });

  it("monthly con día", () => {
    expect(describeRecurrence(rule({ freq: "monthly", interval: 1, dayOfMonth: 5 }))).toBe(
      "Se repite cada mes el día 5",
    );
  });

  it("yearly con mes y día", () => {
    expect(describeRecurrence(rule({ freq: "yearly", interval: 1, dayOfMonth: 20, month: 3 }))).toBe(
      "Se repite cada año el 20 de marzo",
    );
  });
});
