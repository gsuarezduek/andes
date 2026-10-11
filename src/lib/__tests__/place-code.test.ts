import { describe, it, expect } from "vitest";
import { placeCode } from "@/lib/place-code";

describe("placeCode", () => {
  it("detecta oficina", () => {
    expect(placeCode("Oficina Mendoza Ciudad")).toBe("OFI");
  });

  it("detecta aeropuerto, sin importar mayúsculas ni el vehículo (auto/camioneta)", () => {
    expect(placeCode("AEROPUERTO MENDOZA AUTO")).toBe("AER");
    expect(placeCode("Aeropuerto Mendoza Camioneta")).toBe("AER");
  });

  it("detecta hotel", () => {
    expect(placeCode("Hotel en Ciudad de Mendoza Auto")).toBe("HOT");
  });

  it("cualquier otro texto cae en OTR (no hay catálogo estructurado, son 7 filas de texto libre)", () => {
    expect(placeCode("Plaza Independencia")).toBe("OTR");
  });

  it("sin dato (null/vacío) no inventa nada — no es lo mismo que 'otros'", () => {
    expect(placeCode(null)).toBeNull();
    expect(placeCode(undefined)).toBeNull();
    expect(placeCode("")).toBeNull();
    expect(placeCode("   ")).toBeNull();
  });
});
