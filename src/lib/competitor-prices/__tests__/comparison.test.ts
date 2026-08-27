import { describe, it, expect } from "vitest";
import { normalizeOffsetDays } from "../comparison";

describe("normalizeOffsetDays", () => {
  it("acepta un offset disponible", () => {
    expect(normalizeOffsetDays(30, [0, 30, 60])).toBe(30);
  });

  it("offset no disponible → cae al primero", () => {
    expect(normalizeOffsetDays(45, [0, 30, 60])).toBe(0);
  });

  it("sin offset pedido → cae al primero", () => {
    expect(normalizeOffsetDays(undefined, [0, 30, 60])).toBe(0);
  });

  it("sin offsets configurados → 0", () => {
    expect(normalizeOffsetDays(30, [])).toBe(0);
  });
});
