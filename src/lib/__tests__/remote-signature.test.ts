import { describe, it, expect } from "vitest";
import { isSignatureRequestUsable, SIGNATURE_REQUEST_TTL_MS } from "@/lib/remote-signature";

describe("isSignatureRequestUsable", () => {
  const now = new Date("2026-07-12T12:00:00Z");

  it("es usable si está pendiente y no vencido", () => {
    const req = { status: "pending", expiresAt: new Date(now.getTime() + 60_000) };
    expect(isSignatureRequestUsable(req, now)).toBe(true);
  });

  it("no es usable si venció", () => {
    const req = { status: "pending", expiresAt: new Date(now.getTime() - 1) };
    expect(isSignatureRequestUsable(req, now)).toBe(false);
  });

  it("no es usable si ya se firmó (un solo uso)", () => {
    const req = { status: "signed", expiresAt: new Date(now.getTime() + 60_000) };
    expect(isSignatureRequestUsable(req, now)).toBe(false);
  });

  it("no es usable si fue cancelado", () => {
    const req = { status: "cancelled", expiresAt: new Date(now.getTime() + 60_000) };
    expect(isSignatureRequestUsable(req, now)).toBe(false);
  });

  it("el TTL es de 30 minutos", () => {
    expect(SIGNATURE_REQUEST_TTL_MS).toBe(30 * 60 * 1000);
  });
});
