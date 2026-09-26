import { describe, it, expect, vi, beforeEach } from "vitest";

const { prismaMock, storageMock, planMock } = vi.hoisted(() => ({
  prismaMock: {
    storageExport: { findMany: vi.fn() },
    storageCleanupRun: { create: vi.fn(), findUnique: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    deletedFile: { createMany: vi.fn() },
    whatsAppMedia: { updateMany: vi.fn() },
    $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops)),
  },
  storageMock: { delete: vi.fn(), get: vi.fn(), put: vi.fn() },
  planMock: { buildCleanupPlan: vi.fn(), planHash: vi.fn(() => "hash-1") },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/storage", () => ({ storage: () => storageMock }));
vi.mock("@/lib/storage-cleanup", () => planMock);

import { startCleanupRun, processRunBatch } from "@/lib/storage-cleanup-run";

const range = { from: new Date("2024-01-01T00:00:00Z"), toExclusive: new Date("2025-01-01T00:00:00Z") };
const actor = { id: "u1", name: "Admin" };
const item = (key: string, size = 1000) => ({ key, category: "photos" as const, size, zipPath: `z/${key}` });

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.storageCleanupRun.create.mockResolvedValue({ id: "run1" });
});

describe("startCleanupRun — eliminar exige el respaldo completo", () => {
  it("sin ninguna descarga completa: error y no crea la corrida", async () => {
    planMock.buildCleanupPlan.mockResolvedValue({ items: [item("a")] });
    prismaMock.storageExport.findMany.mockResolvedValue([]);
    const r = await startCleanupRun({ action: "delete", categories: ["photos"], range, actor });
    expect(r).toHaveProperty("error");
    expect(prismaMock.storageCleanupRun.create).not.toHaveBeenCalled();
  });

  it("con solo algunas partes descargadas: error", async () => {
    // 2 archivos de 200 MB → 2 partes de 250 MB; solo la 1 descargada.
    planMock.buildCleanupPlan.mockResolvedValue({ items: [item("a", 200 * 1024 * 1024), item("b", 200 * 1024 * 1024)] });
    prismaMock.storageExport.findMany.mockResolvedValue([{ part: 1 }]);
    const r = await startCleanupRun({ action: "delete", categories: ["photos"], range, actor });
    expect(r).toHaveProperty("error");
    expect(prismaMock.storageCleanupRun.create).not.toHaveBeenCalled();
  });

  it("con todas las partes descargadas: crea la corrida con el plan congelado", async () => {
    planMock.buildCleanupPlan.mockResolvedValue({ items: [item("b"), item("a")] });
    prismaMock.storageExport.findMany.mockResolvedValue([{ part: 1 }]);
    const r = await startCleanupRun({ action: "delete", categories: ["photos"], range, actor });
    expect(r).toEqual({ runId: "run1" });
    const data = prismaMock.storageCleanupRun.create.mock.calls[0]![0].data;
    expect(data.action).toBe("delete");
    expect(data.fileCount).toBe(2);
    expect(data.plan.map((p: { key: string }) => p.key)).toEqual(["a", "b"]); // ordenado
    expect(data.createdByName).toBe("Admin");
  });

  it("comprimir no exige respaldo", async () => {
    planMock.buildCleanupPlan.mockResolvedValue({ items: [item("a")] });
    const r = await startCleanupRun({ action: "compress", categories: ["photos"], range, actor });
    expect(r).toEqual({ runId: "run1" });
    expect(prismaMock.storageExport.findMany).not.toHaveBeenCalled();
  });

  it("sin archivos para procesar: error", async () => {
    planMock.buildCleanupPlan.mockResolvedValue({ items: [] });
    expect(await startCleanupRun({ action: "compress", categories: ["photos"], range, actor })).toHaveProperty("error");
  });
});

describe("processRunBatch (eliminar)", () => {
  const baseRun = (over = {}) => ({
    id: "run1",
    action: "delete",
    plan: [item("a"), item("b")].map(({ key, category, size }) => ({ key, category, size })),
    fileCount: 2,
    doneCount: 0,
    changedCount: 0,
    bytesFreed: BigInt(0),
    completedAt: null,
    ...over,
  });

  it("borra la tanda, registra los archivos eliminados y marca la corrida completa", async () => {
    prismaMock.storageCleanupRun.findUnique.mockResolvedValue(baseRun());
    prismaMock.storageCleanupRun.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.storageCleanupRun.update.mockResolvedValue({ ...baseRun(), doneCount: 2, changedCount: 2, bytesFreed: BigInt(2000), completedAt: new Date() });

    const r = await processRunBatch("run1");
    expect(storageMock.delete).toHaveBeenCalledTimes(2);
    expect(prismaMock.deletedFile.createMany.mock.calls[0]![0].data).toHaveLength(2);
    expect(prismaMock.whatsAppMedia.updateMany).toHaveBeenCalled();
    expect(r).toMatchObject({ completed: true, doneCount: 2, bytesFreed: 2000, failed: 0 });
  });

  it("si otra petición ya reclamó ese tramo, no borra nada (evita doble proceso)", async () => {
    prismaMock.storageCleanupRun.findUnique.mockResolvedValue(baseRun());
    prismaMock.storageCleanupRun.updateMany.mockResolvedValue({ count: 0 });
    await processRunBatch("run1");
    expect(storageMock.delete).not.toHaveBeenCalled();
  });

  it("un archivo que falla al borrarse no se registra como eliminado y se cuenta como error", async () => {
    prismaMock.storageCleanupRun.findUnique.mockResolvedValue(baseRun());
    prismaMock.storageCleanupRun.updateMany.mockResolvedValue({ count: 1 });
    storageMock.delete.mockRejectedValueOnce(new Error("R2 caído")).mockResolvedValueOnce(undefined);
    prismaMock.storageCleanupRun.update.mockResolvedValue({ ...baseRun(), doneCount: 2, changedCount: 1, bytesFreed: BigInt(1000), completedAt: new Date() });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const r = await processRunBatch("run1");
    expect(prismaMock.deletedFile.createMany.mock.calls[0]![0].data.map((d: { storageKey: string }) => d.storageKey)).toEqual(["b"]);
    expect(r).toMatchObject({ failed: 1 });
  });

  it("una corrida ya completa no procesa nada", async () => {
    prismaMock.storageCleanupRun.findUnique.mockResolvedValue(baseRun({ doneCount: 2, completedAt: new Date() }));
    const r = await processRunBatch("run1");
    expect(storageMock.delete).not.toHaveBeenCalled();
    expect(r).toMatchObject({ completed: true });
  });
});
