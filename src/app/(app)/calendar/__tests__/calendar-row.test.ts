import { describe, it, expect } from "vitest";
import { barContentTier } from "../calendar-row";

describe("barContentTier", () => {
  it("barra ancha (varios días): horario + nombre + horario", () => {
    expect(barContentTier(164)).toBe("full"); // 1 día en la vista ancha previa (168px de columna)
    expect(barContentTier(110)).toBe("full");
  });

  it("barra media: solo los dos horarios, sin nombre", () => {
    expect(barContentTier(109)).toBe("times");
    expect(barContentTier(70)).toBe("times");
  });

  it("barra angosta (ej. 1 día a 46px de columna): horarios apilados", () => {
    expect(barContentTier(69)).toBe("compact");
    expect(barContentTier(42)).toBe("compact"); // 1 * 46 - 4, el caso real más angosto
  });
});
