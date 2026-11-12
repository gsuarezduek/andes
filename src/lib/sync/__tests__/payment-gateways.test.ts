import { describe, expect, it } from "vitest";
import { parseIdPayment, planGatewaySync, priceAdjustmentFromRow, type CatalogRow } from "../payment-gateways";

const row = (over: Partial<CatalogRow> & { name: string }): CatalogRow => ({
  id: `id-${over.name}`,
  wpGatewayId: null,
  active: null,
  priceAdjustment: null,
  linkedIds: [],
  ...over,
});

describe("parseIdPayment", () => {
  it("separa id y nombre", () => {
    expect(parseIdPayment("8=Stripe")).toEqual({ id: 8, name: "Stripe" });
    expect(parseIdPayment(" 1 = Transferencia de Banco ")).toEqual({ id: 1, name: "Transferencia de Banco" });
  });
  it("descarta valores sin id numérico o sin nombre", () => {
    expect(parseIdPayment(null)).toBeNull();
    expect(parseIdPayment("Stripe")).toBeNull();
    expect(parseIdPayment("=Stripe")).toBeNull();
    expect(parseIdPayment("x=Stripe")).toBeNull();
    expect(parseIdPayment("8=")).toBeNull();
  });
});

describe("planGatewaySync", () => {
  it("marca inactivo el nombre viejo de un método renombrado y le pasa las asociaciones al nuevo", () => {
    const plan = planGatewaySync(
      [row({ name: "Stripe", linkedIds: ["pm-stripe"] }), row({ name: "Tarjeta (Stripe)" })],
      {
        gateways: [{ id: 8, name: "Tarjeta (Stripe)", published: true }],
        seenNames: [
          { id: 8, name: "Stripe" },
          { id: 8, name: "Tarjeta (Stripe)" },
        ],
      },
    );
    expect(plan.update).toEqual([
      { id: "id-Stripe", wpGatewayId: 8, active: false, priceAdjustment: null },
      { id: "id-Tarjeta (Stripe)", wpGatewayId: 8, active: true, priceAdjustment: null },
    ]);
    expect(plan.create).toEqual([]);
    expect(plan.carryLinks).toEqual([{ toName: "Tarjeta (Stripe)", paymentMethodIds: ["pm-stripe"] }]);
  });

  it("no pisa las asociaciones que el nombre nuevo ya tiene", () => {
    const plan = planGatewaySync(
      [row({ name: "Stripe", linkedIds: ["pm-a"] }), row({ name: "Stripe 2", linkedIds: ["pm-b"] })],
      { gateways: [{ id: 8, name: "Stripe 2", published: true }], seenNames: [{ id: 8, name: "Stripe" }] },
    );
    expect(plan.carryLinks).toEqual([]);
  });

  it("crea los métodos activos que todavía no aparecieron en reservas, no los despublicados", () => {
    const plan = planGatewaySync([], {
      gateways: [
        { id: 1, name: "Transferencia", published: true },
        { id: 2, name: "PayPal", published: false },
      ],
      seenNames: [],
    });
    expect(plan.create).toEqual([{ name: "Transferencia", wpGatewayId: 1, active: true, priceAdjustment: null }]);
  });

  it("marca inactivo un método despublicado y no genera cambios si ya está al día", () => {
    const plan = planGatewaySync(
      [row({ name: "PayPal", wpGatewayId: 2, active: true }), row({ name: "Efectivo", wpGatewayId: 3, active: true })],
      {
        gateways: [
          { id: 2, name: "PayPal", published: false },
          { id: 3, name: "Efectivo", published: true },
        ],
        seenNames: [],
      },
    );
    expect(plan.update).toEqual([{ id: "id-PayPal", wpGatewayId: 2, active: false, priceAdjustment: null }]);
  });

  it("no hereda asociaciones de otro método distinto", () => {
    const plan = planGatewaySync([row({ name: "Viejo", linkedIds: ["pm-x"] })], {
      gateways: [{ id: 9, name: "Nuevo", published: true }],
      seenNames: [{ id: 5, name: "Viejo" }],
    });
    expect(plan.carryLinks).toEqual([]);
  });

  it("guarda el descuento de un método y no genera cambios si ya está al día", () => {
    const disc = { value: -5, unit: "percent" as const };
    const plan = planGatewaySync(
      [
        row({ name: "Transferencia Argentina", wpGatewayId: 1, active: true }),
        row({ name: "USDT", wpGatewayId: 4, active: true, priceAdjustment: disc }),
      ],
      {
        gateways: [
          { id: 1, name: "Transferencia Argentina", published: true, priceAdjustment: disc },
          { id: 4, name: "USDT", published: true, priceAdjustment: { value: -5, unit: "percent" } },
          { id: 5, name: "Bitcoin", published: true, priceAdjustment: disc },
        ],
        seenNames: [],
      },
    );
    expect(plan.update).toEqual([
      { id: "id-Transferencia Argentina", wpGatewayId: 1, active: true, priceAdjustment: disc },
    ]);
    expect(plan.create).toEqual([{ name: "Bitcoin", wpGatewayId: 5, active: true, priceAdjustment: disc }]);
  });

  it("borra el descuento si en VikRentCar se sacó, y lo conserva si el plugin no informa nada", () => {
    const disc = { value: -5, unit: "percent" as const };
    const plan = planGatewaySync(
      [
        row({ name: "Transferencia", wpGatewayId: 1, active: true, priceAdjustment: disc }),
        row({ name: "Cripto", wpGatewayId: 2, active: true, priceAdjustment: disc }),
      ],
      {
        gateways: [
          { id: 1, name: "Transferencia", published: true, priceAdjustment: null },
          { id: 2, name: "Cripto", published: true }, // plugin < v1.9.0
        ],
        seenNames: [],
      },
    );
    expect(plan.update).toEqual([{ id: "id-Transferencia", wpGatewayId: 1, active: true, priceAdjustment: null }]);
  });
});

describe("priceAdjustmentFromRow", () => {
  it("descuento y recargo, en porcentaje o monto fijo, con la regla de VikRentCar", () => {
    expect(priceAdjustmentFromRow({ charge: "5.00", ch_disc: 2, val_pcent: 2 })).toEqual({ value: -5, unit: "percent" });
    expect(priceAdjustmentFromRow({ charge: 3, ch_disc: 1, val_pcent: 2 })).toEqual({ value: 3, unit: "percent" });
    expect(priceAdjustmentFromRow({ charge: "1000", ch_disc: "2", val_pcent: "1" })).toEqual({ value: -1000, unit: "fixed" });
  });
  it("sin valor no hay ajuste", () => {
    expect(priceAdjustmentFromRow({ charge: "0.00", ch_disc: 2, val_pcent: 2 })).toBeNull();
    expect(priceAdjustmentFromRow({ charge: null, ch_disc: 1, val_pcent: 1 })).toBeNull();
  });
});
