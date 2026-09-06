import { describe, it, expect } from "vitest";
import { normalizePhone, phoneVariants } from "@/lib/whatsapp/phone";

describe("normalizePhone", () => {
  it("se queda solo con los dígitos y antepone +", () => {
    expect(normalizePhone("+54 9 261 123-4567")).toBe("+5492611234567");
  });

  it("agrega + si no lo tenía", () => {
    expect(normalizePhone("5492611234567")).toBe("+5492611234567");
  });
});

describe("phoneVariants", () => {
  it("incluye la forma con y sin +", () => {
    const variants = phoneVariants("+5492611234567");
    expect(variants).toContain("5492611234567");
    expect(variants).toContain("+5492611234567");
  });

  it("agrega la variante sin el 9 de celular argentino", () => {
    const variants = phoneVariants("+5492611234567");
    expect(variants).toContain("542611234567");
    expect(variants).toContain("+542611234567");
  });

  it("no agrega variante sin 9 para un número que no lo tiene", () => {
    const variants = phoneVariants("+12125551234");
    expect(variants).toEqual(["12125551234", "+12125551234"]);
  });
});
