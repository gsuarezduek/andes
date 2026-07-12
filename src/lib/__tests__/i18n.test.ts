import { describe, it, expect } from "vitest";
import { resolveLocale, isLocale, getDictionary } from "@/lib/i18n";

describe("resolveLocale", () => {
  it("acepta locales soportados tal cual", () => {
    expect(resolveLocale("es")).toBe("es");
    expect(resolveLocale("en")).toBe("en");
  });

  it("normaliza variantes por los dos primeros caracteres", () => {
    expect(resolveLocale("en-US")).toBe("en");
    expect(resolveLocale("es_AR")).toBe("es");
    expect(resolveLocale("English")).toBe("en");
  });

  it("cae al default (es) ante valores desconocidos o vacíos", () => {
    expect(resolveLocale(null)).toBe("es");
    expect(resolveLocale(undefined)).toBe("es");
    expect(resolveLocale("fr")).toBe("es");
    expect(resolveLocale(123)).toBe("es");
  });
});

describe("isLocale", () => {
  it("distingue locales válidos de inválidos", () => {
    expect(isLocale("es")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("pt")).toBe(false);
    expect(isLocale(42)).toBe(false);
  });
});

/** Recolecta todas las rutas de claves de un objeto anidado (ignora valores string). */
function keyPaths(obj: unknown, prefix = ""): string[] {
  if (obj === null || typeof obj !== "object") return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out.push(...keyPaths(v, path));
    } else {
      out.push(path);
    }
  }
  return out.sort();
}

describe("paridad de diccionarios i18n (es/en)", () => {
  it("en tiene exactamente las mismas claves que es", () => {
    const es = keyPaths(getDictionary("es"));
    const en = keyPaths(getDictionary("en"));
    expect(en).toEqual(es);
  });
});
