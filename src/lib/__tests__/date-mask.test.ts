import { describe, expect, it } from "vitest";
import { digitsToDisplay, digitsToIso, isoToDigits } from "../date-mask";

describe("isoToDigits", () => {
  it("convierte YYYY-MM-DD a DDMMYYYY", () => {
    expect(isoToDigits("2027-05-10")).toBe("10052027");
  });

  it("devuelve vacío para un string vacío o inválido", () => {
    expect(isoToDigits("")).toBe("");
    expect(isoToDigits("10/05/2027")).toBe("");
  });
});

describe("digitsToDisplay", () => {
  it("no agrega separadores antes de tener día completo", () => {
    expect(digitsToDisplay("1")).toBe("1");
    expect(digitsToDisplay("10")).toBe("10");
  });

  it("agrega la primera barra tras el día", () => {
    expect(digitsToDisplay("105")).toBe("10/5");
  });

  it("agrega la segunda barra tras el mes", () => {
    expect(digitsToDisplay("1005")).toBe("10/05");
    expect(digitsToDisplay("100520")).toBe("10/05/20");
  });

  it("formatea una fecha completa", () => {
    expect(digitsToDisplay("10052027")).toBe("10/05/2027");
  });
});

describe("digitsToIso", () => {
  it("convierte dígitos completos y válidos a YYYY-MM-DD", () => {
    expect(digitsToIso("10052027")).toBe("2027-05-10");
    expect(digitsToIso("01012026")).toBe("2026-01-01");
  });

  it("devuelve undefined si está incompleto", () => {
    expect(digitsToIso("")).toBeUndefined();
    expect(digitsToIso("1005")).toBeUndefined();
  });

  it("rechaza mes fuera de rango", () => {
    expect(digitsToIso("10132027")).toBeUndefined();
    expect(digitsToIso("10002027")).toBeUndefined();
  });

  it("rechaza día inválido para el mes (incluye años bisiestos)", () => {
    expect(digitsToIso("30022027")).toBeUndefined();
    expect(digitsToIso("29022028")).toBe("2028-02-29");
    expect(digitsToIso("29022027")).toBeUndefined();
  });

  it("rechaza año fuera de rango razonable", () => {
    expect(digitsToIso("10051899")).toBeUndefined();
    expect(digitsToIso("10052201")).toBeUndefined();
  });
});
