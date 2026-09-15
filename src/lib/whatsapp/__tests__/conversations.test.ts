import { describe, it, expect, vi, beforeEach } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    whatsAppConversation: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    rental: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { needsReply, conversationState, autoLinkRentalIfUnambiguous, listConversations } from "@/lib/whatsapp/conversations";

const d = (s: string) => new Date(s);

describe("needsReply", () => {
  it("sin ningún mensaje entrante, nunca está pendiente", () => {
    expect(needsReply({ lastInboundAt: null, lastOutboundAt: null, lastReadAt: null })).toBe(false);
  });

  it("hay un entrante y nunca se respondió ni se vio: pendiente", () => {
    expect(needsReply({ lastInboundAt: d("2026-09-06T10:00:00Z"), lastOutboundAt: null, lastReadAt: null })).toBe(
      true,
    );
  });

  it("se respondió después del último entrante (desde Andes, el bot, o la app): ya no está pendiente", () => {
    expect(
      needsReply({
        lastInboundAt: d("2026-09-06T10:00:00Z"),
        lastOutboundAt: d("2026-09-06T10:05:00Z"),
        lastReadAt: null,
      }),
    ).toBe(false);
  });

  it("se vio en Andes después del último entrante, aunque nadie contestó todavía: ya no está pendiente", () => {
    expect(
      needsReply({
        lastInboundAt: d("2026-09-06T10:00:00Z"),
        lastOutboundAt: null,
        lastReadAt: d("2026-09-06T10:01:00Z"),
      }),
    ).toBe(false);
  });

  it("se vio o se respondió, pero ANTES de un entrante nuevo: vuelve a estar pendiente", () => {
    expect(
      needsReply({
        lastInboundAt: d("2026-09-06T12:00:00Z"),
        lastOutboundAt: d("2026-09-06T10:05:00Z"),
        lastReadAt: d("2026-09-06T10:01:00Z"),
      }),
    ).toBe(true);
  });
});

describe("conversationState", () => {
  const base = {
    rentalId: null as string | null,
    pendingConfirmationAt: null as Date | null,
    followUpAt: null as Date | null,
    lastInboundAt: null as Date | null,
    lastOutboundAt: null as Date | null,
    lastReadAt: null as Date | null,
  };

  it("sin nada marcado, es 'read'", () => {
    expect(conversationState(base)).toBe("read");
  });

  it("con pendingConfirmationAt y sin reserva vinculada, es 'confirm'", () => {
    expect(conversationState({ ...base, pendingConfirmationAt: d("2026-09-06T10:00:00Z") })).toBe("confirm");
  });

  it("'confirm' se resuelve solo al vincular una reserva", () => {
    expect(conversationState({ ...base, pendingConfirmationAt: d("2026-09-06T10:00:00Z"), rentalId: "r1" })).toBe(
      "read",
    );
  });

  it("con followUpAt y el cliente no volvió a escribir, es 'followup'", () => {
    expect(conversationState({ ...base, followUpAt: d("2026-09-06T10:00:00Z") })).toBe("followup");
  });

  it("'followup' se resuelve solo apenas el cliente vuelve a escribir", () => {
    // El nuevo entrante también deja la conversación al día (respondida/vista)
    // para aislar la lógica de followup de la de needsReply, que gana prioridad.
    expect(
      conversationState({
        ...base,
        followUpAt: d("2026-09-06T10:00:00Z"),
        lastInboundAt: d("2026-09-06T11:00:00Z"),
        lastReadAt: d("2026-09-06T11:05:00Z"),
      }),
    ).toBe("read");
  });

  it("un entrante ANTERIOR a followUpAt no lo resuelve (era el mensaje que motivó la cotización)", () => {
    // El bot respondió (seteando followUpAt) después de ese entrante, así que
    // ya está contestado — needsReply no debe interferir con la lectura de followup.
    expect(
      conversationState({
        ...base,
        followUpAt: d("2026-09-06T10:00:00Z"),
        lastInboundAt: d("2026-09-06T09:00:00Z"),
        lastOutboundAt: d("2026-09-06T10:00:01Z"),
      }),
    ).toBe("followup");
  });

  it("'followup' también se resuelve al vincular una reserva", () => {
    expect(conversationState({ ...base, followUpAt: d("2026-09-06T10:00:00Z"), rentalId: "r1" })).toBe("read");
  });

  it("prioridad: 'confirm' gana sobre 'unread'", () => {
    expect(
      conversationState({
        ...base,
        pendingConfirmationAt: d("2026-09-06T10:00:00Z"),
        lastInboundAt: d("2026-09-06T11:00:00Z"),
      }),
    ).toBe("confirm");
  });

});

describe("listConversations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ordena las fijadas primero, incluso por delante de las no leídas", async () => {
    const row = (over: Partial<Record<string, unknown>>) => ({
      id: over.id,
      pinnedAt: over.pinnedAt ?? null,
      lastInboundAt: over.lastInboundAt ?? null,
      lastOutboundAt: null,
      lastReadAt: null,
      messages: [],
    });
    prismaMock.whatsAppConversation.findMany.mockResolvedValue([
      row({ id: "unread", lastInboundAt: d("2026-09-06T10:00:00Z") }),
      row({ id: "pinned-read", pinnedAt: d("2026-09-01T00:00:00Z") }),
      row({ id: "neither" }),
    ]);

    const result = await listConversations();

    expect(result.map((c) => c.id)).toEqual(["pinned-read", "unread", "neither"]);
  });
});

describe("autoLinkRentalIfUnambiguous", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("no hace nada si la conversación ya tiene un vínculo (elegido o quitado a mano)", async () => {
    prismaMock.whatsAppConversation.findUnique.mockResolvedValue({ rentalId: "r1" });

    await autoLinkRentalIfUnambiguous("c1", "+5492611234567");

    expect(prismaMock.rental.findMany).not.toHaveBeenCalled();
    expect(prismaMock.whatsAppConversation.update).not.toHaveBeenCalled();
  });

  it("vincula sola cuando hay exactamente una reserva candidata por teléfono", async () => {
    prismaMock.whatsAppConversation.findUnique.mockResolvedValue({ rentalId: null });
    prismaMock.rental.findMany.mockResolvedValue([{ id: "r2" }]);

    await autoLinkRentalIfUnambiguous("c1", "+5492611234567");

    expect(prismaMock.whatsAppConversation.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { rentalId: "r2" },
    });
  });

  it("no vincula si no hay ninguna candidata", async () => {
    prismaMock.whatsAppConversation.findUnique.mockResolvedValue({ rentalId: null });
    prismaMock.rental.findMany.mockResolvedValue([]);

    await autoLinkRentalIfUnambiguous("c1", "+5492611234567");

    expect(prismaMock.whatsAppConversation.update).not.toHaveBeenCalled();
  });

  it("no vincula si hay más de una candidata (ambiguo) — requiere elegir a mano", async () => {
    prismaMock.whatsAppConversation.findUnique.mockResolvedValue({ rentalId: null });
    prismaMock.rental.findMany.mockResolvedValue([{ id: "r2" }, { id: "r3" }]);

    await autoLinkRentalIfUnambiguous("c1", "+5492611234567");

    expect(prismaMock.whatsAppConversation.update).not.toHaveBeenCalled();
  });
});
