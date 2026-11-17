import { describe, it, expect } from "vitest";
import { computeSettlement, hasLateReturnLine, rollupSettlement } from "@/lib/settlement";

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

  it("arranca sin pagos anotados", () => {
    const s = computeSettlement({ handoverKm: 0, returnKm: 0, handoverFuel: 8, returnFuel: 8, pricing: null });
    expect(s.payments).toEqual([]);
  });

  it("kmDriven nunca es negativo", () => {
    const s = computeSettlement({ handoverKm: 100, returnKm: 90, handoverFuel: 8, returnFuel: 8, pricing: null });
    expect(s.kmDriven).toBe(0);
  });

  it("suma los km de los packs de KM al km incluido", () => {
    const s = computeSettlement({
      handoverKm: 10_000,
      returnKm: 11_000, // 1000 recorridos
      handoverFuel: 8,
      returnFuel: 8,
      // 600 incluidos por día + 2 packs × 200 = 1000 incluidos
      pricing: { kmPerDay: 200, days: 3, extraKmRate: 50, deposit: 0, kmPacks: 2 },
    });
    expect(s.includedKm).toBe(1_000);
    expect(s.extraKm).toBe(0);
    expect(s.extraKmCharge).toBe(0);
  });

  it("los packs de KM suman incluido aunque no haya km/día pactado", () => {
    const s = computeSettlement({
      handoverKm: 10_000,
      returnKm: 10_300,
      handoverFuel: 8,
      returnFuel: 8,
      pricing: { extraKmRate: 50, deposit: 0, kmPacks: 1 }, // 200 incluidos por el pack
    });
    expect(s.includedKm).toBe(200);
    expect(s.extraKm).toBe(100);
    expect(s.extraKmCharge).toBe(5_000);
  });

  it("con KM libres, los packs de KM no aportan incluido (no hay excedente que cobrar)", () => {
    const s = computeSettlement({
      handoverKm: 10_000,
      returnKm: 20_000,
      handoverFuel: 8,
      returnFuel: 8,
      pricing: { kmPerDay: 200, days: 3, extraKmRate: 50, deposit: 0, unlimitedKm: true, kmPacks: 5 },
    });
    expect(s.includedKm).toBe(0);
    expect(s.extraKm).toBe(0);
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

describe("rollupSettlement — payments", () => {
  it("deja pasar las líneas de pago sin tocarlas", () => {
    const base = computeSettlement({ handoverKm: 0, returnKm: 0, handoverFuel: 8, returnFuel: 8, pricing: null });
    const payments = [{ methodName: "Efectivo", amount: 1_000, adjustedAmount: 1_000 }];
    const s = rollupSettlement({ ...base, payments });
    expect(s.payments).toBe(payments);
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

describe("computeSettlement — devolución tardía", () => {
  const END = new Date("2026-03-10T10:00:00.000Z");
  const base = {
    handoverKm: 0,
    returnKm: 0,
    handoverFuel: 8,
    returnFuel: 8,
    pricing: { dailyRate: 50_000, extraHourPercent: 20, deposit: 0 },
    endAt: END,
  };

  it("cobra las horas de atraso al % de hora extra del contrato", () => {
    const s = computeSettlement({ ...base, returnedAt: new Date(END.getTime() + 2 * 3_600_000) });
    expect(s.lateDays).toBe(0);
    expect(s.lateHours).toBe(2);
    expect(s.lateCharge).toBe(20_000); // 2 h × 20% de 50.000
    expect(s.subtotal).toBe(20_000);
    expect(s.balanceDue).toBe(20_000);
  });

  it("devuelto en hora: sin atraso ni cargo", () => {
    const s = computeSettlement({ ...base, returnedAt: END });
    expect(s.lateDays).toBe(0);
    expect(s.lateHours).toBe(0);
    expect(s.lateCharge).toBe(0);
    expect(s.subtotal).toBe(0);
  });

  it("sin la hora real de devolución no inventa atraso", () => {
    // Es el caso de las devoluciones firmadas antes de que esto existiera.
    const s = computeSettlement({ ...base, returnedAt: null });
    expect(s.lateDays).toBe(0);
    expect(s.lateCharge).toBe(0);
  });

  it("el atraso se cobra aparte: la garantía solo cubre daños", () => {
    const s = rollupSettlement({
      ...computeSettlement({
        ...base,
        pricing: { ...base.pricing, deposit: 100_000 },
        returnedAt: new Date(END.getTime() + 26 * 3_600_000), // 1 día + 2 h
        newDamages: [{ description: "Rayón" }],
      }),
      damageCharges: [{ description: "Rayón", amount: 30_000 }],
    });
    expect(s.lateCharge).toBe(70_000); // 1 día + 2 h
    expect(s.subtotal).toBe(100_000);
    expect(s.depositApplied).toBe(30_000); // solo el daño
    expect(s.balanceDue).toBe(70_000); // el atraso, íntegro
    expect(s.depositReturn).toBe(70_000);
  });

  it("el empleado puede ajustar el importe del atraso sin tocar los días/horas", () => {
    const b = computeSettlement({ ...base, returnedAt: new Date(END.getTime() + 3 * 3_600_000) });
    const s = rollupSettlement({ ...b, lateCharge: 10_000 }); // se le cobra menos
    expect(s.lateHours).toBe(3); // el hecho no cambia
    expect(s.lateCharge).toBe(10_000);
    expect(s.balanceDue).toBe(10_000);
  });

  it("una liquidación vieja sin campos de atraso sigue cerrando igual", () => {
    const b = computeSettlement({ handoverKm: 0, returnKm: 0, handoverFuel: 8, returnFuel: 8, pricing: null });
    const { lateDays: _d, lateHours: _h, lateCharge: _c, ...legacy } = b;
    const s = rollupSettlement({ ...legacy, fuelCharge: 5_000 });
    expect(s.lateCharge).toBe(0);
    expect(s.subtotal).toBe(5_000);
    expect(s.balanceDue).toBe(5_000);
  });
});

describe("hasLateReturnLine", () => {
  const empty = { lateDays: 0, lateHours: 0, lateCharge: 0 };

  it("no muestra la línea en una devolución en hora", () => {
    expect(hasLateReturnLine(empty)).toBe(false);
    expect(hasLateReturnLine({})).toBe(false); // liquidación vieja
  });

  it("muestra el atraso aunque se decida no cobrarlo", () => {
    expect(hasLateReturnLine({ ...empty, lateHours: 2 })).toBe(true);
    expect(hasLateReturnLine({ ...empty, lateDays: 1 })).toBe(true);
  });

  it("muestra un cargo cargado a mano sin atraso calculado", () => {
    expect(hasLateReturnLine({ ...empty, lateCharge: 5_000 })).toBe(true);
  });
});
