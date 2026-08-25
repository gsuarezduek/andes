import { describe, it, expect, vi, beforeEach } from "vitest";
import { after } from "next/server";
import type { InspectionInput } from "@/lib/inspection-input";

// --- Mocks (hoisted para poder referenciarlos en vi.mock) ---
const { prismaMock, requireUserMock, actaMock } = vi.hoisted(() => ({
  prismaMock: {
    rental: { findUnique: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
    vehicle: { findUnique: vi.fn(), update: vi.fn() },
    inspection: { create: vi.fn() },
    $transaction: vi.fn(),
  },
  requireUserMock: vi.fn(),
  actaMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth-helpers", () => ({ requireUser: requireUserMock }));
vi.mock("@/lib/acta", () => ({ generateAndSendActa: actaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// No ejecutamos el post-guardado asíncrono (acta/emails) en los tests.
vi.mock("next/server", () => ({ after: vi.fn() }));

import { saveHandover } from "@/app/(app)/rentals/[id]/handover/actions";
import { saveReturn } from "@/app/(app)/rentals/[id]/return/actions";

/** tx capturado por la última llamada a $transaction, con spies para asertar. */
let tx: {
  inspection: { create: ReturnType<typeof vi.fn> };
  rental: { update: ReturnType<typeof vi.fn> };
  vehicle: { update: ReturnType<typeof vi.fn> };
  rentalDocument: { createMany: ReturnType<typeof vi.fn> };
  cashMovement: { createMany: ReturnType<typeof vi.fn> };
};

function wireTransaction(inspectionId = "insp1") {
  prismaMock.$transaction.mockImplementation(async (cb: (t: typeof tx) => unknown) => {
    tx = {
      inspection: { create: vi.fn().mockResolvedValue({ id: inspectionId }) },
      rental: { update: vi.fn().mockResolvedValue({}) },
      vehicle: { update: vi.fn().mockResolvedValue({}) },
      rentalDocument: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
      cashMovement: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
    };
    return cb(tx);
  });
}

const baseInput: InspectionInput = {
  rentalId: "r1",
  vehicleId: "v1",
  language: "es",
  clientName: "Juan Pérez",
  km: 10_500,
  fuelLevel: 8,
  checklist: { c1: "ok", c2: "fail" },
  newDamages: [],
  photoKeys: [],
  signatureKey: "draft/x/signature",
  signerName: "Juan Pérez",
};

beforeEach(() => {
  vi.clearAllMocks();
  requireUserMock.mockResolvedValue({ id: "user1", role: "empleado" });
  wireTransaction();
});

describe("saveHandover", () => {
  it("crea la inspección de entrega, activa el alquiler y marca el auto alquilado", async () => {
    prismaMock.rental.findUnique.mockResolvedValue({ id: "r1", status: "reserved", inspections: [] });
    prismaMock.vehicle.findUnique.mockResolvedValue({ id: "v1" });

    const res = await saveHandover(baseInput);

    expect(res).toEqual({ ok: true, inspectionId: "insp1" });
    expect(tx.inspection.create).toHaveBeenCalledOnce();
    const inspArg = tx.inspection.create.mock.calls[0][0].data;
    expect(inspArg.type).toBe("handover");
    expect(inspArg.km).toBe(10_500);
    // El alquiler pasa a activo; el vehículo a alquilado con el km de entrega.
    expect(tx.rental.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "active" }) }));
    expect(tx.vehicle.update).toHaveBeenCalledWith({ where: { id: "v1" }, data: { status: "rented", currentKm: 10_500 } });
  });

  it("rechaza si el alquiler no está reservado (inmutabilidad)", async () => {
    prismaMock.rental.findUnique.mockResolvedValue({ id: "r1", status: "active", inspections: [] });
    const res = await saveHandover(baseInput);
    expect(res.ok).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rechaza si ya existe una entrega para el alquiler", async () => {
    prismaMock.rental.findUnique.mockResolvedValue({ id: "r1", status: "reserved", inspections: [{ id: "old" }] });
    const res = await saveHandover(baseInput);
    expect(res.ok).toBe(false);
  });

  it("rechaza si el alquiler no existe", async () => {
    prismaMock.rental.findUnique.mockResolvedValue(null);
    const res = await saveHandover(baseInput);
    expect(res.ok).toBe(false);
  });

  it("valida el payload (falta la firma)", async () => {
    prismaMock.rental.findUnique.mockResolvedValue({ id: "r1", status: "reserved", inspections: [] });
    const res = await saveHandover({ ...baseInput, signatureKey: "" });
    expect(res.ok).toBe(false);
  });

  it("persiste los documentos del cliente como evidencia interna", async () => {
    prismaMock.rental.findUnique.mockResolvedValue({ id: "r1", status: "reserved", inspections: [] });
    prismaMock.vehicle.findUnique.mockResolvedValue({ id: "v1" });

    const res = await saveHandover({
      ...baseInput,
      documents: [
        { kind: "license", key: "uploads/d1/documents/a.jpg", localId: "doc1" },
        { kind: "dni", key: "uploads/d1/documents/b.jpg", localId: "doc2" },
      ],
    });

    expect(res.ok).toBe(true);
    expect(tx.rentalDocument.createMany).toHaveBeenCalledOnce();
    const rows = tx.rentalDocument.createMany.mock.calls[0][0].data;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ rentalId: "r1", kind: "license", url: "uploads/d1/documents/a.jpg", uploadedById: "user1" });
  });

  it("no toca rentalDocument cuando no hay documentos", async () => {
    prismaMock.rental.findUnique.mockResolvedValue({ id: "r1", status: "reserved", inspections: [] });
    prismaMock.vehicle.findUnique.mockResolvedValue({ id: "v1" });
    await saveHandover(baseInput);
    expect(tx.rentalDocument.createMany).not.toHaveBeenCalled();
  });

  it("persiste conductores adicionales y la licencia con su nombre", async () => {
    prismaMock.rental.findUnique.mockResolvedValue({ id: "r1", status: "reserved", inspections: [] });
    prismaMock.vehicle.findUnique.mockResolvedValue({ id: "v1" });

    await saveHandover({
      ...baseInput,
      additionalDrivers: [{ name: "María Gómez" }],
      documents: [{ kind: "license", key: "uploads/d1/documents/m.jpg", localId: "doc3", holderName: "María Gómez" }],
    });

    // El nombre queda en el alquiler como conductor autorizado.
    expect(tx.rental.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ additionalDrivers: [{ name: "María Gómez" }] }) }),
    );
    // La foto de la licencia lleva holderName.
    const rows = tx.rentalDocument.createMany.mock.calls[0][0].data;
    expect(rows[0]).toMatchObject({ kind: "license", holderName: "María Gómez" });
  });

  it("persiste el desglose de pagos (con la aclaración de 'Otro') en rental.pricing", async () => {
    prismaMock.rental.findUnique.mockResolvedValue({ id: "r1", status: "reserved", inspections: [] });
    prismaMock.vehicle.findUnique.mockResolvedValue({ id: "v1" });

    await saveHandover({
      ...baseInput,
      pricing: {
        total: 50_000,
        paid: 10_000,
        payments: [
          {
            methodId: "pm1",
            methodName: "Otro",
            amount: 10_000,
            adjustedAmount: 10_000,
            note: "Transferencia a cuenta personal del encargado",
          },
        ],
      },
    });

    const rentalArg = tx.rental.update.mock.calls[0][0].data;
    expect(rentalArg.pricing.payments).toHaveLength(1);
    expect(rentalArg.pricing.payments[0]).toMatchObject({
      methodName: "Otro",
      note: "Transferencia a cuenta personal del encargado",
    });

    // El pago queda también anotado como cobro en Caja, vinculado a la reserva.
    expect(tx.cashMovement.createMany).toHaveBeenCalledOnce();
    const movements = tx.cashMovement.createMany.mock.calls[0][0].data;
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({
      type: "income",
      amount: 10_000,
      paymentMethodName: "Otro",
      paymentMethodNote: "Transferencia a cuenta personal del encargado",
      rentalId: "r1",
      createdById: "user1",
    });
  });

  it("no crea movimientos de Caja cuando no hay pagos", async () => {
    prismaMock.rental.findUnique.mockResolvedValue({ id: "r1", status: "reserved", inspections: [] });
    prismaMock.vehicle.findUnique.mockResolvedValue({ id: "v1" });
    await saveHandover(baseInput);
    expect(tx.cashMovement.createMany).not.toHaveBeenCalled();
  });

  it("no duplica en Caja un pago que ya tiene cashMovementId (cargado antes con 'Agregar pago' o importado del sync)", async () => {
    prismaMock.rental.findUnique.mockResolvedValue({ id: "r1", status: "reserved", inspections: [] });
    prismaMock.vehicle.findUnique.mockResolvedValue({ id: "v1" });

    await saveHandover({
      ...baseInput,
      pricing: {
        total: 50_000,
        paid: 30_000,
        payments: [
          // Ya tenía su movimiento en Caja (ej. "Agregar pago" antes de la entrega).
          { methodId: "pm1", methodName: "Efectivo", amount: 20_000, adjustedAmount: 20_000, cashMovementId: "cm_old" },
          // Nueva, cargada recién en el wizard.
          { methodId: "pm2", methodName: "Transferencia", amount: 10_000, adjustedAmount: 10_000 },
        ],
      },
    });

    // pricing.payments conserva las dos líneas (para "Paga"/el resumen).
    const rentalArg = tx.rental.update.mock.calls[0][0].data;
    expect(rentalArg.pricing.payments).toHaveLength(2);

    // Pero solo se crea movimiento para la que no tenía cashMovementId.
    expect(tx.cashMovement.createMany).toHaveBeenCalledOnce();
    const movements = tx.cashMovement.createMany.mock.calls[0][0].data;
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({ amount: 10_000, paymentMethodName: "Transferencia" });
  });

  it("registra el autor del daño (reportedById) en la inspección", async () => {
    prismaMock.rental.findUnique.mockResolvedValue({ id: "r1", status: "reserved", inspections: [] });
    prismaMock.vehicle.findUnique.mockResolvedValue({ id: "v1" });

    await saveHandover({
      ...baseInput,
      newDamages: [{ view: "top", posX: 0.5, posY: 0.5, description: "Rayón" }],
    });

    const inspArg = tx.inspection.create.mock.calls[0][0].data;
    expect(inspArg.damages.create[0]).toMatchObject({ description: "Rayón", reportedById: "user1" });
  });

  describe("avanzar sin señal (evidencia pendiente)", () => {
    it("confirma la entrega con la firma todavía sin subir y no dispara el acta todavía", async () => {
      prismaMock.rental.findUnique.mockResolvedValue({ id: "r1", status: "reserved", inspections: [] });
      prismaMock.vehicle.findUnique.mockResolvedValue({ id: "v1" });

      const res = await saveHandover({
        ...baseInput,
        signatureKey: undefined,
        photoKeys: [],
        pendingEvidence: [{ kind: "signature", localId: "sig-local-1" }],
      });

      expect(res).toEqual({ ok: true, inspectionId: "insp1" });
      const inspArg = tx.inspection.create.mock.calls[0][0].data;
      expect(inspArg.signatureUrl).toBeNull();
      expect(inspArg.pendingEvidence).toEqual([{ kind: "signature", localId: "sig-local-1" }]);
      // El auto igual queda entregado (rental activo, vehículo alquilado): eso
      // no espera a que termine de subir la evidencia.
      expect(tx.rental.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "active" }) }));
      // El acta/email quedan para cuando `attachInspectionEvidence` complete el manifiesto.
      expect(after).not.toHaveBeenCalled();
    });

    it("rechaza si no hay firma subida ni pendiente", async () => {
      prismaMock.rental.findUnique.mockResolvedValue({ id: "r1", status: "reserved", inspections: [] });
      const res = await saveHandover({ ...baseInput, signatureKey: undefined });
      expect(res.ok).toBe(false);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it("dispara el acta de inmediato cuando no queda evidencia pendiente (comportamiento de siempre)", async () => {
      prismaMock.rental.findUnique.mockResolvedValue({ id: "r1", status: "reserved", inspections: [] });
      prismaMock.vehicle.findUnique.mockResolvedValue({ id: "v1" });
      await saveHandover(baseInput);
      expect(after).toHaveBeenCalledOnce();
    });
  });
});

describe("saveReturn", () => {
  const returnInput: InspectionInput = { ...baseInput, km: 10_900 };

  it("cierra el alquiler, libera el auto y guarda el km de devolución", async () => {
    prismaMock.rental.findUnique.mockResolvedValue({
      id: "r1",
      status: "active",
      inspections: [{ id: "h1", type: "handover", km: 10_500 }],
    });

    const res = await saveReturn(returnInput);

    expect(res).toEqual({ ok: true, inspectionId: "insp1" });
    const inspArg = tx.inspection.create.mock.calls[0][0].data;
    expect(inspArg.type).toBe("return_");
    expect(tx.rental.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "finished" }) }));
    expect(tx.vehicle.update).toHaveBeenCalledWith({ where: { id: "v1" }, data: { status: "available", currentKm: 10_900 } });
  });

  it("persiste la liquidación en la inspección de devolución", async () => {
    prismaMock.rental.findUnique.mockResolvedValue({
      id: "r1",
      status: "active",
      clientName: "Juan Pérez",
      inspections: [{ id: "h1", type: "handover", km: 10_500 }],
    });
    const settlement = {
      kmDriven: 400, includedKm: 0, extraKm: 0, extraKmRate: 0, extraKmCharge: 0,
      fuelMissingEighths: 2, fuelCharge: 5_000, damageCharges: [], damagesTotal: 0,
      subtotal: 5_000, deposit: 20_000, depositApplied: 5_000, balanceDue: 0,
      depositReturn: 15_000, method: "retencion_deposito" as const,
    };
    await saveReturn({ ...returnInput, settlement });
    const inspArg = tx.inspection.create.mock.calls[0][0].data;
    expect(inspArg.settlement).toMatchObject({ subtotal: 5_000, method: "retencion_deposito" });
    // Liquidación vieja (sin `payments`, compat): no crea nada en Caja.
    expect(tx.cashMovement.createMany).not.toHaveBeenCalled();
  });

  it("crea un cobro en Caja por cada pago anotado en la liquidación", async () => {
    prismaMock.rental.findUnique.mockResolvedValue({
      id: "r1",
      status: "active",
      clientName: "Juan Pérez",
      inspections: [{ id: "h1", type: "handover", km: 10_500 }],
    });
    const settlement = {
      kmDriven: 400, includedKm: 0, extraKm: 0, extraKmRate: 0, extraKmCharge: 0,
      fuelMissingEighths: 2, fuelCharge: 5_000, damageCharges: [], damagesTotal: 0,
      subtotal: 5_000, deposit: 0, depositApplied: 0, balanceDue: 5_000,
      depositReturn: 0,
      payments: [
        { methodId: "pm1", methodName: "Efectivo", amount: 5_000, adjustedAmount: 5_000 },
      ],
    };
    await saveReturn({ ...returnInput, settlement });

    expect(tx.cashMovement.createMany).toHaveBeenCalledOnce();
    const movements = tx.cashMovement.createMany.mock.calls[0][0].data;
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({
      type: "income",
      amount: 5_000,
      paymentMethodName: "Efectivo",
      rentalId: "r1",
      createdById: "user1",
    });
  });

  it("no duplica en Caja un pago de la liquidación que ya tiene cashMovementId", async () => {
    prismaMock.rental.findUnique.mockResolvedValue({
      id: "r1",
      status: "active",
      clientName: "Juan Pérez",
      inspections: [{ id: "h1", type: "handover", km: 10_500 }],
    });
    const settlement = {
      kmDriven: 400, includedKm: 0, extraKm: 0, extraKmRate: 0, extraKmCharge: 0,
      fuelMissingEighths: 2, fuelCharge: 5_000, damageCharges: [], damagesTotal: 0,
      subtotal: 5_000, deposit: 0, depositApplied: 0, balanceDue: 5_000,
      depositReturn: 0,
      payments: [
        { methodId: "pm1", methodName: "Efectivo", amount: 3_000, adjustedAmount: 3_000, cashMovementId: "cm_old" },
        { methodId: "pm2", methodName: "Transferencia", amount: 2_000, adjustedAmount: 2_000 },
      ],
    };
    await saveReturn({ ...returnInput, settlement });

    expect(tx.cashMovement.createMany).toHaveBeenCalledOnce();
    const movements = tx.cashMovement.createMany.mock.calls[0][0].data;
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({ amount: 2_000, paymentMethodName: "Transferencia" });
  });

  it("recalcula la liquidación server-side en vez de confiar en los totales del cliente (SEC-03)", async () => {
    prismaMock.rental.findUnique.mockResolvedValue({
      id: "r1",
      status: "active",
      clientName: "Juan Pérez",
      pricing: { kmPerDay: 200, days: 2, extraKmRate: 100, deposit: 50_000 },
      inspections: [{ id: "h1", type: "handover", km: 10_000, fuelLevel: 8 }],
    });
    // Cliente manipulado: los importes editables (extraKmCharge/fuelCharge/
    // damageCharges/deposit) son reales, pero los totales derivados vienen
    // adulterados para esconder el saldo real (debería dar $10.000, no $0).
    const tamperedSettlement = {
      kmDriven: 500, includedKm: 400, extraKm: 100, extraKmRate: 100, extraKmCharge: 10_000,
      fuelMissingEighths: 0, fuelCharge: 0, damageCharges: [], damagesTotal: 0,
      subtotal: 0, // debería ser 10.000
      deposit: 50_000, depositApplied: 0, balanceDue: 0, // debería ser 10.000
      depositReturn: 50_000,
    };
    await saveReturn({ ...returnInput, km: 10_500, settlement: tamperedSettlement });

    const inspArg = tx.inspection.create.mock.calls[0][0].data;
    expect(inspArg.settlement).toMatchObject({
      extraKmCharge: 10_000,
      subtotal: 10_000,
      balanceDue: 10_000,
      depositReturn: 50_000,
    });
  });

  it("rechaza km de devolución menor al de entrega", async () => {
    prismaMock.rental.findUnique.mockResolvedValue({
      id: "r1",
      status: "active",
      inspections: [{ id: "h1", type: "handover", km: 10_500 }],
    });
    const res = await saveReturn({ ...returnInput, km: 10_000 });
    expect(res.ok).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it("rechaza si no hay entrega registrada", async () => {
    prismaMock.rental.findUnique.mockResolvedValue({ id: "r1", status: "active", inspections: [] });
    const res = await saveReturn(returnInput);
    expect(res.ok).toBe(false);
  });

  it("rechaza si ya existe una devolución", async () => {
    prismaMock.rental.findUnique.mockResolvedValue({
      id: "r1",
      status: "active",
      inspections: [
        { id: "h1", type: "handover", km: 10_500 },
        { id: "ret1", type: "return_", km: 10_800 },
      ],
    });
    const res = await saveReturn(returnInput);
    expect(res.ok).toBe(false);
  });

  it("rechaza si el alquiler no está activo", async () => {
    prismaMock.rental.findUnique.mockResolvedValue({ id: "r1", status: "finished", inspections: [] });
    const res = await saveReturn(returnInput);
    expect(res.ok).toBe(false);
  });

  describe("avanzar sin señal (evidencia pendiente)", () => {
    it("cierra la devolución con fotos todavía sin subir y no dispara el acta todavía", async () => {
      prismaMock.rental.findUnique.mockResolvedValue({
        id: "r1",
        status: "active",
        inspections: [{ id: "h1", type: "handover", km: 10_500 }],
      });

      const res = await saveReturn({
        ...returnInput,
        photoKeys: [],
        pendingEvidence: [{ kind: "photo", localId: "photo-local-1" }],
      });

      expect(res).toEqual({ ok: true, inspectionId: "insp1" });
      const inspArg = tx.inspection.create.mock.calls[0][0].data;
      expect(inspArg.pendingEvidence).toEqual([{ kind: "photo", localId: "photo-local-1" }]);
      expect(tx.rental.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "finished" }) }));
      expect(after).not.toHaveBeenCalled();
    });

    it("rechaza si no hay firma subida ni pendiente", async () => {
      prismaMock.rental.findUnique.mockResolvedValue({
        id: "r1",
        status: "active",
        inspections: [{ id: "h1", type: "handover", km: 10_500 }],
      });
      const res = await saveReturn({ ...returnInput, signatureKey: undefined });
      expect(res.ok).toBe(false);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });
  });
});
