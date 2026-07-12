import { describe, it, expect, vi } from "vitest";

// reports.ts importa prisma; lo mockeamos para poder testear el helper puro
// sin instanciar el cliente.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { recentMonths } from "@/lib/reports";

describe("recentMonths", () => {
  it("devuelve los N meses hasta el actual, del más viejo al actual", () => {
    expect(recentMonths("2026-02", 3)).toEqual(["2025-12", "2026-01", "2026-02"]);
  });

  it("maneja el cambio de año", () => {
    expect(recentMonths("2026-01", 2)).toEqual(["2025-12", "2026-01"]);
  });

  it("12 meses termina en el mes actual y arranca 11 atrás", () => {
    const months = recentMonths("2026-07", 12);
    expect(months).toHaveLength(12);
    expect(months[0]).toBe("2025-08");
    expect(months[11]).toBe("2026-07");
  });
});
