import { describe, it, expect, beforeAll } from "vitest";

beforeAll(() => {
  process.env.ENCRYPTION_KEY = "a".repeat(64);
});

describe("encrypt/decrypt", () => {
  it("descifra lo que cifró", async () => {
    const { encrypt, decrypt } = await import("@/lib/encryption");
    const secret = "sk-super-secreto-123";
    const encrypted = encrypt(secret);
    expect(encrypted).not.toBe(secret);
    expect(decrypt(encrypted)).toBe(secret);
  });

  it("genera un iv distinto en cada llamada (mismo texto, cifrados distintos)", async () => {
    const { encrypt } = await import("@/lib/encryption");
    expect(encrypt("hola")).not.toBe(encrypt("hola"));
  });

  it("rechaza un valor con formato inválido", async () => {
    const { decrypt } = await import("@/lib/encryption");
    expect(() => decrypt("no-tiene-el-formato-esperado")).toThrow();
  });
});
