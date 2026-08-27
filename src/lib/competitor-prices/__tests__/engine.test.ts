import { describe, it, expect, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    competitor: { findMany: vi.fn() },
    competitorCategory: { findMany: vi.fn() },
    competitorPriceSettings: { findUnique: vi.fn() },
    competitorCheckRun: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    competitorCategoryMapping: { findUnique: vi.fn(), create: vi.fn() },
    competitorPriceCheck: { create: vi.fn() },
    competitorCurrentPrice: { upsert: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { runCompetitorPriceCheck } from "@/lib/competitor-prices/engine";

const COMPETITOR = {
  id: "c1",
  name: "Mock Competitor",
  url: "https://example-competitor.test",
  active: true,
  adapterKey: "mock",
  config: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

let checkIdCounter = 0;

beforeEach(() => {
  vi.clearAllMocks();
  checkIdCounter = 0;
  prismaMock.competitorCheckRun.findFirst.mockResolvedValue(null); // sin corrida en curso
  prismaMock.competitorCheckRun.create.mockResolvedValue({ id: "run1" });
  prismaMock.competitorCheckRun.update.mockResolvedValue({});
  prismaMock.competitor.findMany.mockResolvedValue([COMPETITOR]);
  prismaMock.competitorCategory.findMany.mockResolvedValue([
    { id: "economico", label: "Económico" },
    { id: "suv", label: "SUV" },
  ]);
  prismaMock.competitorPriceSettings.findUnique.mockResolvedValue({
    id: 1,
    offsetsDays: [0], // una sola ventana para acotar el test
    rentalDurationDays: 3,
    updatedAt: new Date(),
  });
  prismaMock.competitorPriceCheck.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
    id: `check${checkIdCounter++}`,
    ...data,
  }));
  prismaMock.competitorCurrentPrice.upsert.mockResolvedValue({});
});

describe("runCompetitorPriceCheck", () => {
  it("con mapeo ya confirmado: resuelve el precio y actualiza CompetitorCurrentPrice", async () => {
    // El adaptador mock devuelve "Chevrolet Onix o similar" y "Jeep Renegade o similar".
    prismaMock.competitorCategoryMapping.findUnique.mockImplementation(
      async ({ where }: { where: { competitorId_rawLabel: { rawLabel: string } } }) => {
        if (where.competitorId_rawLabel.rawLabel === "Chevrolet Onix o similar") {
          return { competitorId: "c1", rawLabel: "Chevrolet Onix o similar", categoryId: "economico" };
        }
        return null; // "Jeep Renegade o similar" sin mapear todavía
      },
    );
    prismaMock.competitorCategoryMapping.create.mockResolvedValue({});

    const summary = await runCompetitorPriceCheck("manual");

    expect(summary.result).toBe("success");
    expect(summary.competitorsChecked).toBe(1);
    // Solo "economico" tiene mapeo confirmado -> 1 categoría actualizada
    // (el Jeep queda en needs_review de categoría, no cuenta para la tabla).
    expect(summary.pricesFound).toBe(1);
    expect(summary.errors).toBe(0);

    // Se creó la fila pendiente de confirmación para el rawLabel nuevo.
    expect(prismaMock.competitorCategoryMapping.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ competitorId: "c1", rawLabel: "Jeep Renegade o similar" }),
      }),
    );

    // CompetitorCurrentPrice se actualizó solo para la categoría confirmada.
    expect(prismaMock.competitorCurrentPrice.upsert).toHaveBeenCalledTimes(1);
    const upsertCall = prismaMock.competitorCurrentPrice.upsert.mock.calls[0][0];
    expect(upsertCall.where.competitorId_categoryId_pickupOffsetDays.categoryId).toBe("economico");

    // El precio persistido viene del grounding contra el priceCandidate del mock (sin LLM).
    const priceCheckCalls = prismaMock.competitorPriceCheck.create.mock.calls;
    const onixCall = priceCheckCalls.find((c) => c[0].data.rawLabel === "Chevrolet Onix o similar");
    expect(onixCall![0].data).toMatchObject({ price: 75000, currency: "ars", status: "auto_found" });
  });

  it("sin ningún mapeo confirmado: no actualiza CompetitorCurrentPrice pero igual queda el historial", async () => {
    prismaMock.competitorCategoryMapping.findUnique.mockResolvedValue(null);
    prismaMock.competitorCategoryMapping.create.mockResolvedValue({});

    const summary = await runCompetitorPriceCheck("manual");

    expect(summary.pricesFound).toBe(0);
    expect(summary.result).toBe("success"); // no es un error -- simplemente no hay categorías confirmadas todavía
    expect(prismaMock.competitorCurrentPrice.upsert).not.toHaveBeenCalled();
    // Igual se persistió el log histórico de ambos autos.
    expect(prismaMock.competitorPriceCheck.create).toHaveBeenCalledTimes(2);
  });

  it("adaptador unavailable: registra el motivo, no crea precio", async () => {
    prismaMock.competitor.findMany.mockResolvedValue([{ ...COMPETITOR, adapterKey: "unavailable-mock" }]);

    // Registrar un adaptador ad-hoc que siempre falla, sin tocar el registry real.
    vi.doMock("@/lib/competitor-prices/adapters", () => ({
      getAdapter: () => ({
        key: "unavailable-mock",
        fetchPrices: async () => ({ status: "unavailable" as const, reason: "timeout" }),
      }),
    }));
    vi.resetModules();
    const { runCompetitorPriceCheck: run2 } = await import("@/lib/competitor-prices/engine");

    const summary = await run2("manual");
    expect(summary.pricesFound).toBe(0);
    expect(prismaMock.competitorPriceCheck.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "unavailable", errorReason: "timeout" }) }),
    );
  });

  it("guard de concurrencia: no arranca una corrida nueva si ya hay una en curso", async () => {
    prismaMock.competitorCheckRun.findFirst.mockResolvedValue({ id: "already-running", finishedAt: null });

    const summary = await runCompetitorPriceCheck("manual");

    expect(summary.result).toBe("error");
    expect(summary.competitorsChecked).toBe(0);
    expect(prismaMock.competitorCheckRun.create).not.toHaveBeenCalled();
  });
});
