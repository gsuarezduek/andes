import { describe, it, expect } from "vitest";
import { formatSpecialDateLabel } from "@/lib/special-dates";

describe("formatSpecialDateLabel", () => {
  it("arma 'Día D de mes', sin año", () => {
    // 2026-10-12 es lunes.
    expect(formatSpecialDateLabel("2026-10-12")).toBe("Lunes 12 de octubre");
  });

  it("funciona para cualquier día de la semana", () => {
    // 2026-12-25 es viernes.
    expect(formatSpecialDateLabel("2026-12-25")).toBe("Viernes 25 de diciembre");
  });
});
