import { describe, it, expect } from "vitest";
import { isClientNameMissing, isSignatureRequestUsable, missingClientFields, SIGNATURE_REQUEST_TTL_MS } from "@/lib/remote-signature";

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

  it("el TTL es de 3 horas", () => {
    expect(SIGNATURE_REQUEST_TTL_MS).toBe(3 * 60 * 60 * 1000);
  });
});

describe("isClientNameMissing", () => {
  it("true si está vacío o es el sentinel 'Sin nombre' (sin importar mayúsculas/espacios)", () => {
    expect(isClientNameMissing("")).toBe(true);
    expect(isClientNameMissing("   ")).toBe(true);
    expect(isClientNameMissing("Sin nombre")).toBe(true);
    expect(isClientNameMissing("sin NOMBRE")).toBe(true);
    expect(isClientNameMissing("  Sin nombre  ")).toBe(true);
  });

  it("false si es un nombre real", () => {
    expect(isClientNameMissing("Juan Pérez")).toBe(false);
  });
});

describe("missingClientFields", () => {
  const full = { name: "Juan Pérez", email: "j@x.com", phone: "123", docNumber: "30111222", address: "San Martín 123" };

  it("no devuelve nada si todo está completo", () => {
    expect(missingClientFields(full)).toEqual([]);
  });

  it("detecta el nombre faltante por el sentinel 'Sin nombre' (sin importar mayúsculas)", () => {
    expect(missingClientFields({ ...full, name: "Sin nombre" })).toEqual(["name"]);
    expect(missingClientFields({ ...full, name: "sin nombre" })).toEqual(["name"]);
  });

  it("detecta el nombre faltante si viene vacío", () => {
    expect(missingClientFields({ ...full, name: "  " })).toEqual(["name"]);
  });

  it("detecta email/teléfono/documento/domicilio nulos o vacíos", () => {
    expect(
      missingClientFields({ ...full, email: null, phone: "", docNumber: null, address: "  " }),
    ).toEqual(["email", "phone", "docNumber", "address"]);
  });

  it("mezcla varios campos faltantes a la vez, en el orden esperado", () => {
    expect(missingClientFields({ ...full, name: "Sin nombre", address: null })).toEqual(["name", "address"]);
  });
});
