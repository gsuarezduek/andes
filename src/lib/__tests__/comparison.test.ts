import { describe, it, expect } from "vitest";
import { computeComparison } from "@/lib/comparison";

describe("computeComparison", () => {
  it("calcula km recorridos y diferencia de nafta", () => {
    const c = computeComparison({
      handoverKm: 10_000,
      returnKm: 10_450,
      handoverFuel: 8,
      returnFuel: 5,
      newDamages: 2,
    });
    expect(c.kmDriven).toBe(450);
    expect(c.fuelDiff).toBe(-3);
    expect(c.newDamages).toBe(2);
  });

  it("kmDriven es 0 cuando se devuelve con el mismo kilometraje", () => {
    const c = computeComparison({
      handoverKm: 20_000,
      returnKm: 20_000,
      handoverFuel: 4,
      returnFuel: 4,
      newDamages: 0,
    });
    expect(c.kmDriven).toBe(0);
    expect(c.fuelDiff).toBe(0);
  });

  it("fuelDiff positivo cuando devuelve con más nafta", () => {
    const c = computeComparison({
      handoverKm: 0,
      returnKm: 100,
      handoverFuel: 2,
      returnFuel: 6,
      newDamages: 0,
    });
    expect(c.fuelDiff).toBe(4);
  });

  it("preserva los valores originales de entrega y devolución", () => {
    const c = computeComparison({
      handoverKm: 5,
      returnKm: 9,
      handoverFuel: 8,
      returnFuel: 7,
      newDamages: 1,
    });
    expect(c.handoverKm).toBe(5);
    expect(c.returnKm).toBe(9);
    expect(c.handoverFuel).toBe(8);
    expect(c.returnFuel).toBe(7);
  });
});
