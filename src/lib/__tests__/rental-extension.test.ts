import { describe, expect, it } from "vitest";
import { extensionExtraDays, suggestedExtensionAmount } from "@/lib/rental-extension";

describe("extensionExtraDays", () => {
  it("cuenta días completos redondeando hacia arriba", () => {
    const prev = new Date("2026-09-20T12:00:00Z");
    expect(extensionExtraDays(prev, new Date("2026-09-22T12:00:00Z"))).toBe(2);
    expect(extensionExtraDays(prev, new Date("2026-09-21T13:00:00Z"))).toBe(2); // día empezado cuenta entero
    expect(extensionExtraDays(prev, new Date("2026-09-21T12:00:00Z"))).toBe(1);
  });

  it("devuelve 0 si la nueva fecha no es posterior", () => {
    const prev = new Date("2026-09-20T12:00:00Z");
    expect(extensionExtraDays(prev, prev)).toBe(0);
    expect(extensionExtraDays(prev, new Date("2026-09-19T12:00:00Z"))).toBe(0);
  });
});

describe("suggestedExtensionAmount", () => {
  it("multiplica la tarifa diaria por los días extra", () => {
    expect(suggestedExtensionAmount(15000, 2)).toBe(30000);
  });

  it("devuelve null sin tarifa o sin días extra", () => {
    expect(suggestedExtensionAmount(null, 2)).toBeNull();
    expect(suggestedExtensionAmount(15000, 0)).toBeNull();
  });
});
