import { describe, expect, it, vi, beforeEach } from "vitest";

import { syncCommission, deleteCommissionOf } from "@/lib/commissions-sync";

const actor = { id: "u1", name: "Admin" };

const method = {
  id: "pm1",
  name: "Tarjeta",
  commissionPercent: 3,
  commissionFixed: null,
  commissionCategory: { id: "cat1", name: "Comisiones" },
};

function income(overrides: Record<string, unknown> = {}) {
  return {
    id: "inc1",
    type: "income",
    description: "Seña — Juan",
    amount: 10_000,
    currency: "ars",
    deletedAt: null,
    isGuarantee: false,
    needsConfirmation: false,
    paymentMethod: method,
    ...overrides,
  };
}

let tx: {
  cashMovement: {
    findUnique: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  cashMovementEdit: { create: ReturnType<typeof vi.fn> };
};

function setup(inc: unknown, existing: unknown = null) {
  tx = {
    cashMovement: {
      findUnique: vi.fn().mockResolvedValue(inc),
      findFirst: vi.fn().mockResolvedValue(existing),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
    },
    cashMovementEdit: { create: vi.fn().mockResolvedValue({}) },
  };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const run = () => syncCommission(tx as any, "inc1", actor);

const existingCommission = {
  id: "com1",
  amount: 300,
  currency: "ars",
  paymentMethodId: "pm1",
  paymentMethodName: "Tarjeta",
  categoryId: "cat1",
  categoryName: "Comisiones",
};

beforeEach(() => vi.clearAllMocks());

describe("syncCommission", () => {
  it("crea el egreso de comisión de la misma cuenta, con la categoría, sin reserva", async () => {
    setup(income());
    await run();
    expect(tx.cashMovement.create).toHaveBeenCalledOnce();
    expect(tx.cashMovement.create.mock.calls[0][0].data).toMatchObject({
      type: "expense",
      amount: 300,
      currency: "ars",
      paymentMethodId: "pm1",
      categoryId: "cat1",
      commissionSourceId: "inc1",
      createdByName: "Admin",
    });
    expect(tx.cashMovement.create.mock.calls[0][0].data.rentalId).toBeUndefined();
  });

  it("no crea nada si el medio no tiene comisión", async () => {
    setup(income({ paymentMethod: { ...method, commissionPercent: null, commissionFixed: null } }));
    await run();
    expect(tx.cashMovement.create).not.toHaveBeenCalled();
  });

  it("no aplica a garantías, a ingresos sin confirmar ni a egresos", async () => {
    for (const o of [{ isGuarantee: true }, { needsConfirmation: true }, { type: "expense" }]) {
      setup(income(o));
      await run();
      expect(tx.cashMovement.create).not.toHaveBeenCalled();
    }
  });

  it("es idempotente: si la comisión ya está bien, no toca nada", async () => {
    setup(income(), existingCommission);
    await run();
    expect(tx.cashMovement.create).not.toHaveBeenCalled();
    expect(tx.cashMovement.update).not.toHaveBeenCalled();
    expect(tx.cashMovementEdit.create).not.toHaveBeenCalled();
  });

  it("recalcula el monto si el ingreso cambió y deja constancia", async () => {
    setup(income({ amount: 20_000 }), existingCommission);
    await run();
    expect(tx.cashMovement.update.mock.calls[0][0].data).toMatchObject({ amount: 600 });
    expect(tx.cashMovementEdit.create.mock.calls[0][0].data).toMatchObject({
      cashMovementId: "com1",
      action: "updated",
      changes: [{ field: "Monto", from: expect.stringContaining("300"), to: expect.stringContaining("600") }],
    });
  });

  it("elimina la comisión si el ingreso pasó a un medio sin comisión", async () => {
    setup(income({ paymentMethod: { ...method, commissionPercent: null } }), existingCommission);
    await run();
    expect(tx.cashMovement.update.mock.calls[0][0].data.deletedAt).toBeInstanceOf(Date);
    expect(tx.cashMovementEdit.create.mock.calls[0][0].data.action).toBe("deleted");
  });
});

describe("deleteCommissionOf", () => {
  it("elimina la comisión vinculada al ingreso borrado", async () => {
    setup(null, existingCommission);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await deleteCommissionOf(tx as any, "inc1", actor);
    expect(tx.cashMovement.update).toHaveBeenCalledOnce();
    expect(tx.cashMovementEdit.create.mock.calls[0][0].data.action).toBe("deleted");
  });
  it("no hace nada si el ingreso no tenía comisión", async () => {
    setup(null, null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await deleteCommissionOf(tx as any, "inc1", actor);
    expect(tx.cashMovement.update).not.toHaveBeenCalled();
  });
});
