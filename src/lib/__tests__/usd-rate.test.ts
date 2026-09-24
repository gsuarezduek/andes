import { describe, expect, it } from "vitest";
import { toArs, usdRateAt } from "@/lib/usd-rate";

const d = (s: string) => new Date(s);
const history = [
  { rate: 1000, createdAt: d("2026-09-01T00:00:00Z") },
  { rate: 1200, createdAt: d("2026-09-10T00:00:00Z") },
];

describe("usdRateAt", () => {
  it("sin historial devuelve null", () => {
    expect(usdRateAt([], d("2026-09-15T00:00:00Z"))).toBeNull();
  });
  it("usa el último valor cargado hasta esa fecha", () => {
    expect(usdRateAt(history, d("2026-09-05T00:00:00Z"))).toBe(1000);
    expect(usdRateAt(history, d("2026-09-10T00:00:00Z"))).toBe(1200);
    expect(usdRateAt(history, d("2026-09-20T00:00:00Z"))).toBe(1200);
  });
  it("antes del primer valor cargado usa el primero disponible", () => {
    expect(usdRateAt(history, d("2026-01-01T00:00:00Z"))).toBe(1000);
  });
});

describe("toArs", () => {
  it("ARS queda igual, con o sin valor de referencia", () => {
    expect(toArs(500, "ars", null)).toBe(500);
    expect(toArs(500, "ars", 1200)).toBe(500);
  });
  it("USD se multiplica por el valor de referencia", () => {
    expect(toArs(100, "usd", 1200)).toBe(120000);
  });
  it("USD sin valor de referencia no se puede convertir", () => {
    expect(toArs(100, "usd", null)).toBeNull();
  });
});
