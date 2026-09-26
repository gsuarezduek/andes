import { describe, it, expect } from "vitest";
import { checkHandoverKm, checkReturnKm } from "@/lib/km-check";

describe("checkHandoverKm", () => {
  it("km igual o apenas mayor al registrado: sin aviso", () => {
    expect(checkHandoverKm(126422, 126422)).toBeNull();
    expect(checkHandoverKm(126600, 126422)).toBeNull();
  });

  it("tolera unos pocos km por debajo (diferencia entre lecturas)", () => {
    expect(checkHandoverKm(126410, 126422)).toBeNull();
  });

  it("avisa cuando falta un dígito (el caso real: 12.624 en vez de 126.4xx)", () => {
    expect(checkHandoverKm(12624, 126422)).toMatch(/menor al último registrado/);
  });

  it("avisa cuando sobra un dígito o el salto es enorme", () => {
    expect(checkHandoverKm(977674, 95836)).toMatch(/más que el último registrado/);
  });

  it("no rompe con valores inválidos", () => {
    expect(checkHandoverKm(NaN, 100)).toBeNull();
  });
});

describe("checkReturnKm", () => {
  it("recorrido normal: sin aviso", () => {
    expect(checkReturnKm(1600, 1000, 1)).toBeNull();
    expect(checkReturnKm(126735, 126422, 5)).toBeNull();
  });

  it("escala el tope con los días del alquiler", () => {
    expect(checkReturnKm(4500, 1000, 4)).toBeNull(); // 3.500 km en 4 días
    expect(checkReturnKm(6000, 1000, 4)).toMatch(/recorrió 5\.000 km en 4 días/);
  });

  it("avisa el caso real: 114.111 km en 5 días", () => {
    expect(checkReturnKm(126735, 12624, 5)).toMatch(/114\.111 km en 5 días/);
  });

  it("sin días conocidos usa 1 (singular)", () => {
    expect(checkReturnKm(3000, 1000, undefined)).toMatch(/en 1 día /);
    expect(checkReturnKm(1900, 1000, 0)).toBeNull();
  });
});
