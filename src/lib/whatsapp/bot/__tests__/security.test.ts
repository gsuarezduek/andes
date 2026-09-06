import { describe, it, expect } from "vitest";
import { findMatch } from "@/lib/whatsapp/bot/security";

describe("findMatch", () => {
  it("encuentra una palabra sin importar mayúsculas/minúsculas", () => {
    expect(findMatch("Quiero CANCELAR mi reserva", ["cancelar"])).toBe("cancelar");
  });

  it("devuelve null si ninguna palabra matchea", () => {
    expect(findMatch("Hola, buen día", ["cancelar", "reclamo"])).toBeNull();
  });

  it("ignora palabras vacías en la lista", () => {
    expect(findMatch("hola", ["", "  "])).toBeNull();
  });

  it("matchea como substring, no como palabra completa", () => {
    expect(findMatch("¿lo puedo cancelaría?", ["cancelar"])).toBe("cancelar");
  });

  it("devuelve la primera palabra que matchea", () => {
    expect(findMatch("cancelar y reclamo", ["reclamo", "cancelar"])).toBe("reclamo");
  });
});
