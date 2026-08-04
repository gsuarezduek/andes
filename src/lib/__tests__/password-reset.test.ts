import { describe, it, expect } from "vitest";
import {
  generatePasswordResetToken,
  hashPasswordResetToken,
  isPasswordResetTokenUsable,
  PASSWORD_RESET_TTL_MS,
} from "@/lib/password-reset";

describe("generatePasswordResetToken", () => {
  it("genera un token cuyo hash coincide con hashPasswordResetToken", () => {
    const { token, tokenHash } = generatePasswordResetToken();
    expect(hashPasswordResetToken(token)).toBe(tokenHash);
  });

  it("genera tokens distintos en cada llamada", () => {
    const a = generatePasswordResetToken();
    const b = generatePasswordResetToken();
    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).not.toBe(b.tokenHash);
  });
});

describe("isPasswordResetTokenUsable", () => {
  const now = new Date("2026-07-12T12:00:00Z");

  it("es usable si no fue usado y no venció", () => {
    const record = { usedAt: null, expiresAt: new Date(now.getTime() + 60_000) };
    expect(isPasswordResetTokenUsable(record, now)).toBe(true);
  });

  it("no es usable si venció", () => {
    const record = { usedAt: null, expiresAt: new Date(now.getTime() - 1) };
    expect(isPasswordResetTokenUsable(record, now)).toBe(false);
  });

  it("no es usable si ya se usó (un solo uso)", () => {
    const record = { usedAt: new Date(now.getTime() - 1000), expiresAt: new Date(now.getTime() + 60_000) };
    expect(isPasswordResetTokenUsable(record, now)).toBe(false);
  });

  it("el TTL es de 1 hora", () => {
    expect(PASSWORD_RESET_TTL_MS).toBe(60 * 60 * 1000);
  });
});
