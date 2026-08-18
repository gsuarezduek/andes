import { describe, it, expect } from "vitest";
import { serviceOverdueSeverity } from "@/lib/service-alerts";

describe("serviceOverdueSeverity", () => {
  it("justo en el km de service (excedente 0): siempre ámbar", () => {
    expect(serviceOverdueSeverity(10_000, 10_000, 10_000, 15)).toBe("amber");
  });

  it("excedente dentro del % configurado: ámbar", () => {
    // intervalo 10.000km, 15% = 1.500km de gracia; 1.000km pasado, dentro de la gracia.
    expect(serviceOverdueSeverity(11_000, 10_000, 10_000, 15)).toBe("amber");
  });

  it("excedente justo en el límite del %: todavía ámbar (no estrictamente mayor)", () => {
    expect(serviceOverdueSeverity(11_500, 10_000, 10_000, 15)).toBe("amber");
  });

  it("excedente por encima del % configurado: rojo", () => {
    expect(serviceOverdueSeverity(11_501, 10_000, 10_000, 15)).toBe("red");
    expect(serviceOverdueSeverity(15_000, 10_000, 10_000, 15)).toBe("red");
  });

  it("sin intervalo configurado: cualquier excedente es rojo de inmediato", () => {
    expect(serviceOverdueSeverity(10_001, 10_000, null, 15)).toBe("red");
    expect(serviceOverdueSeverity(10_000, 10_000, null, 15)).toBe("amber");
  });

  it("respeta un % distinto al default", () => {
    // intervalo 10.000km, 5% = 500km de gracia.
    expect(serviceOverdueSeverity(10_400, 10_000, 10_000, 5)).toBe("amber");
    expect(serviceOverdueSeverity(10_600, 10_000, 10_000, 5)).toBe("red");
  });

  it("% en 0: cualquier excedente es rojo, igual que sin intervalo", () => {
    expect(serviceOverdueSeverity(10_100, 10_000, 10_000, 0)).toBe("red");
  });
});
