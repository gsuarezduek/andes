import { describe, it, expect, vi, beforeEach } from "vitest";
import type { InspectionInput } from "@/lib/inspection-input";

// --- Mocks (hoisted para poder referenciarlos en vi.mock) ---
const { prismaMock, requireUserMock, actaMock } = vi.hoisted(() => ({
  prismaMock: {
    rental: { findUnique: vi.fn(), update: vi.fn() },
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
};

function wireTransaction(inspectionId = "insp1") {
  prismaMock.$transaction.mockImplementation(async (cb: (t: typeof tx) => unknown) => {
    tx = {
      inspection: { create: vi.fn().mockResolvedValue({ id: inspectionId }) },
      rental: { update: vi.fn().mockResolvedValue({}) },
      vehicle: { update: vi.fn().mockResolvedValue({}) },
      rentalDocument: { createMany: vi.fn().mockResolvedValue({ count: 0 }) },
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
        { kind: "license", key: "uploads/d1/documents/a.jpg" },
        { kind: "dni", key: "uploads/d1/documents/b.jpg" },
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
});
