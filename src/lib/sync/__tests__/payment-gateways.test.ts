import { describe, expect, it } from "vitest";
import { parseIdPayment, planGatewaySync, type CatalogRow } from "../payment-gateways";

const row = (over: Partial<CatalogRow> & { name: string }): CatalogRow => ({
  id: `id-${over.name}`,
  wpGatewayId: null,
  active: null,
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
      { id: "id-Stripe", wpGatewayId: 8, active: false },
      { id: "id-Tarjeta (Stripe)", wpGatewayId: 8, active: true },
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
    expect(plan.create).toEqual([{ name: "Transferencia", wpGatewayId: 1, active: true }]);
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
    expect(plan.update).toEqual([{ id: "id-PayPal", wpGatewayId: 2, active: false }]);
  });

  it("no hereda asociaciones de otro método distinto", () => {
    const plan = planGatewaySync([row({ name: "Viejo", linkedIds: ["pm-x"] })], {
      gateways: [{ id: 9, name: "Nuevo", published: true }],
      seenNames: [{ id: 5, name: "Viejo" }],
    });
    expect(plan.carryLinks).toEqual([]);
  });
});
