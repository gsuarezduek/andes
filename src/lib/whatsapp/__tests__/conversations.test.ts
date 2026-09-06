import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { needsReply } from "@/lib/whatsapp/conversations";

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
