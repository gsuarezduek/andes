import { describe, it, expect, vi, beforeEach } from "vitest";
import { after } from "next/server";
import { revalidatePath } from "next/cache";

const { prismaMock, requireUserMock, actaMock } = vi.hoisted(() => ({
  prismaMock: {
    inspection: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    inspectionMedia: { findMany: vi.fn(), upsert: vi.fn() },
    rentalDocument: { findMany: vi.fn(), upsert: vi.fn() },
    damage: { findMany: vi.fn(), update: vi.fn() },
  },
  requireUserMock: vi.fn(),
  actaMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/auth-helpers", () => ({ requireUser: requireUserMock }));
vi.mock("@/lib/acta", () => ({ generateAndSendActa: actaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));

import { attachInspectionEvidence } from "@/app/(app)/evidence-actions";

beforeEach(() => {
  vi.clearAllMocks();
  requireUserMock.mockResolvedValue({ id: "user1", role: "empleado" });
  prismaMock.inspectionMedia.findMany.mockResolvedValue([]);
  prismaMock.rentalDocument.findMany.mockResolvedValue([]);
  prismaMock.damage.findMany.mockResolvedValue([]);
});

describe("attachInspectionEvidence", () => {
  it("adjunta la firma pendiente pero no completa si quedan otros ítems", async () => {
    const manifest = [
      { kind: "signature", localId: "sig1" },
      { kind: "photo", localId: "photo1" },
    ];
    prismaMock.inspection.findUnique
      .mockResolvedValueOnce({ id: "insp1", rentalId: "r1", pendingEvidence: manifest, evidenceCompletedAt: null })
      .mockResolvedValueOnce({ signatureUrl: "sig-key" });
    prismaMock.inspectionMedia.findMany.mockResolvedValue([]); // photo1 todavía no subió

    const res = await attachInspectionEvidence({ inspectionId: "insp1", localId: "sig1", kind: "signature", key: "sig-key" });

    expect(prismaMock.inspection.update).toHaveBeenCalledWith({ where: { id: "insp1" }, data: { signatureUrl: "sig-key" } });
    expect(res).toEqual({ ok: true, complete: false });
    expect(prismaMock.inspection.updateMany).not.toHaveBeenCalled();
    expect(after).not.toHaveBeenCalled();
  });

  it("completa el manifiesto y dispara el acta al subir el último ítem pendiente", async () => {
    const manifest = [{ kind: "photo", localId: "photo1" }];
    prismaMock.inspection.findUnique
      .mockResolvedValueOnce({ id: "insp1", rentalId: "r1", pendingEvidence: manifest, evidenceCompletedAt: null })
      .mockResolvedValueOnce({ signatureUrl: "ya-estaba" });
    prismaMock.inspectionMedia.findMany.mockResolvedValue([{ id: "photo1" }]);
    prismaMock.inspection.updateMany.mockResolvedValue({ count: 1 });

    const res = await attachInspectionEvidence({ inspectionId: "insp1", localId: "photo1", kind: "photo", key: "photo-key" });

    expect(prismaMock.inspectionMedia.upsert).toHaveBeenCalledWith({
      where: { id: "photo1" },
      update: {},
      create: { id: "photo1", inspectionId: "insp1", type: "photo", url: "photo-key", capturedAt: expect.any(Date) },
    });
    expect(prismaMock.inspection.updateMany).toHaveBeenCalledWith({
      where: { id: "insp1", evidenceCompletedAt: null },
      data: { evidenceCompletedAt: expect.any(Date) },
    });
    expect(after).toHaveBeenCalledOnce();
    expect(revalidatePath).toHaveBeenCalledWith("/rentals/r1");
    expect(res).toEqual({ ok: true, complete: true });
  });

  it("no dispara el acta dos veces si otro llamado ya completó el manifiesto (carrera)", async () => {
    const manifest = [{ kind: "photo", localId: "photo1" }];
    prismaMock.inspection.findUnique
      .mockResolvedValueOnce({ id: "insp1", rentalId: "r1", pendingEvidence: manifest, evidenceCompletedAt: null })
      .mockResolvedValueOnce({ signatureUrl: null });
    prismaMock.inspectionMedia.findMany.mockResolvedValue([{ id: "photo1" }]);
    // Otro llamado concurrente ya lo completó: el guard no afecta ninguna fila.
    prismaMock.inspection.updateMany.mockResolvedValue({ count: 0 });

    const res = await attachInspectionEvidence({ inspectionId: "insp1", localId: "photo1", kind: "photo", key: "photo-key" });

    expect(after).not.toHaveBeenCalled();
    expect(res).toEqual({ ok: true, complete: true });
  });

  it("adjunta la foto de un daño actualizando Damage.photoUrl", async () => {
    const manifest = [{ kind: "damagePhoto", localId: "dmgphoto1", damageId: "dmg1" }];
    prismaMock.inspection.findUnique
      .mockResolvedValueOnce({ id: "insp1", rentalId: "r1", pendingEvidence: manifest, evidenceCompletedAt: null })
      .mockResolvedValueOnce({ signatureUrl: null });
    prismaMock.damage.findMany.mockResolvedValue([{ id: "dmg1", photoUrl: "dmg-key" }]);
    prismaMock.inspection.updateMany.mockResolvedValue({ count: 1 });

    const res = await attachInspectionEvidence({ inspectionId: "insp1", localId: "dmgphoto1", kind: "damagePhoto", key: "dmg-key" });

    expect(prismaMock.damage.update).toHaveBeenCalledWith({ where: { id: "dmg1" }, data: { photoUrl: "dmg-key" } });
    expect(res).toEqual({ ok: true, complete: true });
  });

  it("adjunta un documento usando el docKind/holderName del manifiesto guardado en el servidor, no del input", async () => {
    const manifest = [{ kind: "document", localId: "doc1", docKind: "dni", holderName: "María Gómez" }];
    prismaMock.inspection.findUnique
      .mockResolvedValueOnce({ id: "insp1", rentalId: "r1", pendingEvidence: manifest, evidenceCompletedAt: null })
      .mockResolvedValueOnce({ signatureUrl: null });
    prismaMock.rentalDocument.findMany.mockResolvedValue([{ id: "doc1" }]);
    prismaMock.inspection.updateMany.mockResolvedValue({ count: 1 });

    await attachInspectionEvidence({ inspectionId: "insp1", localId: "doc1", kind: "document", key: "doc-key" });

    expect(prismaMock.rentalDocument.upsert).toHaveBeenCalledWith({
      where: { id: "doc1" },
      update: {},
      create: { id: "doc1", rentalId: "r1", kind: "dni", url: "doc-key", holderName: "María Gómez", uploadedById: "user1" },
    });
  });

  it("es idempotente si el ítem ya no está en el manifiesto (ya adjuntado, o llamado duplicado)", async () => {
    prismaMock.inspection.findUnique.mockResolvedValueOnce({
      id: "insp1",
      rentalId: "r1",
      pendingEvidence: [],
      evidenceCompletedAt: new Date(),
    });

    const res = await attachInspectionEvidence({ inspectionId: "insp1", localId: "sig1", kind: "signature", key: "sig-key" });

    expect(prismaMock.inspection.update).not.toHaveBeenCalled();
    expect(res).toEqual({ ok: true, complete: true });
  });

  it("rechaza si la inspección no existe", async () => {
    prismaMock.inspection.findUnique.mockResolvedValueOnce(null);
    const res = await attachInspectionEvidence({ inspectionId: "no-existe", localId: "x", kind: "photo", key: "k" });
    expect(res.ok).toBe(false);
  });

  it("rechaza un input inválido", async () => {
    const res = await attachInspectionEvidence({ inspectionId: "insp1", localId: "x", kind: "no-existe", key: "k" });
    expect(res.ok).toBe(false);
    expect(prismaMock.inspection.findUnique).not.toHaveBeenCalled();
  });
});
