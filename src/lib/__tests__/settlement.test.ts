import { describe, it, expect } from "vitest";
import { computeSettlement, rollupSettlement } from "@/lib/settlement";

describe("computeSettlement", () => {
  it("cobra el excedente de km sobre lo incluido en el contrato", () => {
    const s = computeSettlement({
      handoverKm: 10_000,
      returnKm: 11_000, // 1000 recorridos
      handoverFuel: 8,
      returnFuel: 8,
      pricing: { kmPerDay: 200, days: 3, extraKmRate: 50, deposit: 0 }, // 600 incluidos
    });
    expect(s.kmDriven).toBe(1_000);
    expect(s.includedKm).toBe(600);
    expect(s.extraKm).toBe(400);
    expect(s.extraKmCharge).toBe(20_000); // 400 × 50
    expect(s.subtotal).toBe(20_000);
  });

  it("no cobra excedente si no hay km incluido pactado (sin límite)", () => {
    const s = computeSettlement({
      handoverKm: 10_000,
      returnKm: 15_000,
      handoverFuel: 8,
      returnFuel: 8,
      pricing: { extraKmRate: 50, deposit: 0 }, // sin kmPerDay/days
    });
    expect(s.includedKm).toBe(0);
    expect(s.extraKm).toBe(0);
    expect(s.extraKmCharge).toBe(0);
  });

  it("con KM libres no cobra excedente aunque haya km incluido y tarifa pactados", () => {
    const s = computeSettlement({
      handoverKm: 10_000,
      returnKm: 20_000, // 10.000 recorridos
      handoverFuel: 8,
      returnFuel: 8,
      pricing: { kmPerDay: 200, days: 3, extraKmRate: 50, deposit: 0, unlimitedKm: true },
    });
    expect(s.includedKm).toBe(0);
    expect(s.extraKm).toBe(0);
    expect(s.extraKmCharge).toBe(0);
    expect(s.subtotal).toBe(0);
  });

  it("registra la nafta faltante sin cobrarla automáticamente", () => {
    const s = computeSettlement({
      handoverKm: 0,
      returnKm: 100,
      handoverFuel: 8,
      returnFuel: 5,
      pricing: null,
    });
    expect(s.fuelMissingEighths).toBe(3);
    expect(s.fuelCharge).toBe(0);
  });

  it("crea una línea de cargo por cada daño nuevo (importe 0 inicial)", () => {
    const s = computeSettlement({
      handoverKm: 0,
      returnKm: 0,
      handoverFuel: 8,
      returnFuel: 8,
      pricing: null,
      newDamages: [{ description: "Rayón puerta" }, {}],
    });
    expect(s.damageCharges).toHaveLength(2);
    expect(s.damageCharges[0]).toEqual({ description: "Rayón puerta", amount: 0 });
    expect(s.damageCharges[1].description).toBe("Daño #2");
  });

  it("kmDriven nunca es negativo", () => {
    const s = computeSettlement({ handoverKm: 100, returnKm: 90, handoverFuel: 8, returnFuel: 8, pricing: null });
    expect(s.kmDriven).toBe(0);
  });

  it("preserva centavos en el cargo por km extra", () => {
    const s = computeSettlement({
      handoverKm: 10_000,
      returnKm: 10_003, // 3 km sobre lo incluido
      handoverFuel: 8,
      returnFuel: 8,
      pricing: { kmPerDay: 1, days: 1, extraKmRate: 33.33, deposit: 0 }, // 1 incluido
    });
    expect(s.extraKm).toBe(2);
    expect(s.extraKmCharge).toBe(66.66);
  });
});

describe("rollupSettlement", () => {
  const base = () =>
    computeSettlement({
      handoverKm: 10_000,
      returnKm: 11_000,
      handoverFuel: 8,
      returnFuel: 6,
      pricing: { kmPerDay: 200, days: 3, extraKmRate: 50, deposit: 20_000 },
      newDamages: [{ description: "Golpe paragolpes" }],
    });

  it("sin daños: el km extra y la nafta se cobran aparte y no descuentan del depósito", () => {
    const s = rollupSettlement({ ...base(), fuelCharge: 2_000 }); // sin daño cargado (amount 0)
    expect(s.subtotal).toBe(22_000);
    expect(s.depositApplied).toBe(0);
    expect(s.balanceDue).toBe(22_000); // km extra + nafta, íntegro
    expect(s.depositReturn).toBe(20_000); // depósito entero, no consumido por daños
  });

  it("subtotal menor al depósito: saldo 0 y se devuelve la diferencia", () => {
    const b = base();
    // Anulamos el excedente de km para bajar el subtotal por debajo del depósito.
    const s = rollupSettlement({ ...b, extraKmCharge: 0 });
    expect(s.subtotal).toBe(0);
    expect(s.balanceDue).toBe(0);
    expect(s.depositReturn).toBe(20_000);
  });

  it("suma los cargos por daño editados", () => {
    const b = base();
    const s = rollupSettlement({
      ...b,
      extraKmCharge: 0,
      damageCharges: [{ description: "Golpe paragolpes", amount: 35_000 }],
    });
    expect(s.damagesTotal).toBe(35_000);
    expect(s.subtotal).toBe(35_000);
    expect(s.depositApplied).toBe(20_000);
    expect(s.balanceDue).toBe(15_000);
  });

  it("daño parcial: cubre lo que puede del depósito y devuelve el resto, además del km/nafta aparte", () => {
    const b = base(); // extraKmCharge 20000, deposit 20000
    const s = rollupSettlement({
      ...b,
      damageCharges: [{ description: "Golpe paragolpes", amount: 5_000 }],
    });
    expect(s.depositApplied).toBe(5_000);
    expect(s.depositReturn).toBe(15_000);
    expect(s.balanceDue).toBe(20_000); // el km extra, ajeno al depósito
  });
});
