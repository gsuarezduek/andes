import { describe, it, expect, vi } from "vitest";

// cash.ts importa prisma; lo mockeamos para poder testear los helpers puros
// sin instanciar el cliente.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { prevMonth, nextMonth } from "@/lib/cash";

describe("prevMonth", () => {
  it("resta un mes dentro del mismo año", () => {
    expect(prevMonth("2026-07")).toBe("2026-06");
  });

  it("maneja el cambio de año", () => {
    expect(prevMonth("2026-01")).toBe("2025-12");
  });
});

describe("nextMonth", () => {
  it("suma un mes dentro del mismo año", () => {
    expect(nextMonth("2026-07")).toBe("2026-08");
  });

  it("maneja el cambio de año", () => {
    expect(nextMonth("2026-12")).toBe("2027-01");
  });
});
