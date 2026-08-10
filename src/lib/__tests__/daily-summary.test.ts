import { describe, it, expect, vi } from "vitest";

// daily-summary.ts importa dashboard.ts (solo por los tipos de sus alertas),
// que a su vez importa prisma; lo mockeamos para poder testear la lógica
// pura sin instanciar el cliente.
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { buildDailySummary } from "@/lib/daily-summary";

type OverdueReturn = Parameters<typeof buildDailySummary>[0][number];
type ServiceCandidate = Parameters<typeof buildDailySummary>[1][number];

function overdueReturn(overrides: Partial<OverdueReturn>): OverdueReturn {
  return {
    clientName: "Juan Pérez",
    endAt: new Date("2026-08-01T12:00:00Z"),
    vehicle: { plate: "AA123BB" },
    ...overrides,
  } as OverdueReturn;
}

function serviceCandidate(overrides: Partial<ServiceCandidate>): ServiceCandidate {
  return {
    brand: "Fiat",
    model: "Cronos",
    plate: "AA123BB",
    currentKm: 10000,
    nextServiceKm: 9500,
    overdue: true,
    ...overrides,
  } as ServiceCandidate;
}

describe("buildDailySummary", () => {
  it("devuelve null si no hay nada vencido", () => {
    expect(buildDailySummary([], [])).toBeNull();
  });

  it("ignora los service 'próximos' (no vencidos todavía)", () => {
    const upcoming = serviceCandidate({ overdue: false, currentKm: 9200, nextServiceKm: 9500 });
    expect(buildDailySummary([], [upcoming])).toBeNull();
  });

  it("arma el asunto y el cuerpo con devoluciones vencidas", () => {
    const summary = buildDailySummary([overdueReturn({})], []);
    expect(summary).not.toBeNull();
    expect(summary!.subject).toBe("Andes — 1 alerta pendiente");
    expect(summary!.html).toContain("Devoluciones vencidas (1)");
    expect(summary!.html).toContain("Juan Pérez");
    expect(summary!.html).toContain("AA123BB");
  });

  it("arma el asunto y el cuerpo con service vencido", () => {
    const summary = buildDailySummary([], [serviceCandidate({})]);
    expect(summary).not.toBeNull();
    expect(summary!.html).toContain("Service vencido (1)");
    expect(summary!.html).toContain("Fiat Cronos");
    expect(summary!.html).toContain("500 km pasado");
  });

  it("suma ambos tipos en el asunto (plural)", () => {
    const summary = buildDailySummary(
      [overdueReturn({}), overdueReturn({ clientName: "Ana Gómez" })],
      [serviceCandidate({})],
    );
    expect(summary!.subject).toBe("Andes — 3 alertas pendientes");
    expect(summary!.html).toContain("Devoluciones vencidas (2)");
    expect(summary!.html).toContain("Service vencido (1)");
  });

  it("usa 'sin unidad' cuando la reserva no tiene vehículo asignado", () => {
    const summary = buildDailySummary([overdueReturn({ vehicle: null })], []);
    expect(summary!.html).toContain("sin unidad");
  });
});
