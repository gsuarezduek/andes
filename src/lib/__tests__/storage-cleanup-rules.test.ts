import { describe, it, expect } from "vitest";
import {
  categoriesFor,
  effectiveRange,
  extOf,
  MIN_AGE_DAYS,
  parseCategories,
  parseDateRange,
  safeSegment,
  splitIntoParts,
  worthReplacing,
} from "@/lib/storage-cleanup-rules";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-09-26T15:00:00Z");

describe("parseDateRange", () => {
  it("toma desde/hasta inclusive en hora de Mendoza", () => {
    const r = parseDateRange("2025-01-01", "2025-01-31");
    if ("error" in r) throw new Error(r.error);
    // Mendoza es UTC-3: 00:00 local = 03:00Z; "hasta" es exclusivo el día siguiente.
    expect(r.from.toISOString()).toBe("2025-01-01T03:00:00.000Z");
    expect(r.toExclusive.toISOString()).toBe("2025-02-01T03:00:00.000Z");
  });

  it("acepta un solo día", () => {
    const r = parseDateRange("2025-03-10", "2025-03-10");
    expect("error" in r).toBe(false);
  });

  it("rechaza fechas vacías, mal formadas o invertidas", () => {
    expect("error" in parseDateRange("", "2025-01-01")).toBe(true);
    expect("error" in parseDateRange("2025-1-1", "2025-01-31")).toBe(true);
    expect("error" in parseDateRange("2025-02-01", "2025-01-01")).toBe(true);
  });
});

describe("effectiveRange (antigüedad mínima)", () => {
  const wide = { from: new Date("2020-01-01T00:00:00Z"), toExclusive: new Date("2027-01-01T00:00:00Z") };

  it("eliminar evidencia recorta a lo anterior a 180 días", () => {
    const r = effectiveRange(wide, "delete", "photos", NOW)!;
    expect(r.toExclusive.getTime()).toBe(NOW.getTime() - MIN_AGE_DAYS.deleteEvidence * DAY);
  });

  it("comprimir evidencia recorta a lo anterior a 30 días", () => {
    const r = effectiveRange(wide, "compress", "actas", NOW)!;
    expect(r.toExclusive.getTime()).toBe(NOW.getTime() - MIN_AGE_DAYS.compressEvidence * DAY);
  });

  it("WhatsApp no tiene antigüedad mínima", () => {
    const r = effectiveRange({ ...wide, toExclusive: NOW }, "delete", "wa_audio", NOW)!;
    expect(r.toExclusive.getTime()).toBe(NOW.getTime());
  });

  it("descargar nunca recorta", () => {
    const past = { from: new Date("2025-01-01T00:00:00Z"), toExclusive: new Date("2026-09-20T00:00:00Z") };
    expect(effectiveRange(past, "export", "photos", NOW)).toEqual(past);
  });

  it("un rango que queda vacío tras el recorte devuelve null", () => {
    const recent = { from: new Date(NOW.getTime() - 10 * DAY), toExclusive: NOW };
    expect(effectiveRange(recent, "delete", "photos", NOW)).toBeNull();
  });

  it("un rango ya anterior al corte no se toca", () => {
    const old = { from: new Date("2024-01-01T00:00:00Z"), toExclusive: new Date("2024-02-01T00:00:00Z") };
    expect(effectiveRange(old, "delete", "videos", NOW)).toEqual(old);
  });
});

describe("categorías por acción", () => {
  it("firmas y actas NUNCA se pueden eliminar", () => {
    const del = categoriesFor("delete");
    expect(del).not.toContain("signatures");
    expect(del).not.toContain("actas");
    expect(parseCategories(["signatures", "actas", "photos"], "delete")).toEqual(["photos"]);
  });

  it("comprimir admite fotos, firmas y actas pero no video/audio", () => {
    const c = categoriesFor("compress");
    expect(c).toEqual(expect.arrayContaining(["photos", "damage_photos", "documents", "wa_image", "signatures", "actas"]));
    expect(c).not.toContain("videos");
    expect(c).not.toContain("wa_video");
    expect(c).not.toContain("wa_audio");
  });

  it("descargar admite todo, y parseCategories descarta valores inventados y repetidos", () => {
    expect(parseCategories(["photos", "photos", "hack", "actas"], "export")).toEqual(["photos", "actas"]);
  });
});

describe("splitIntoParts", () => {
  const item = (zipPath: string, size: number) => ({ zipPath, size });

  it("reparte en partes sin pasar el tope y en orden por ruta", () => {
    const parts = splitIntoParts([item("c", 60), item("a", 60), item("b", 60)], 100);
    expect(parts.map((p) => p.map((i) => i.zipPath))).toEqual([["a"], ["b"], ["c"]]);
    const parts2 = splitIntoParts([item("c", 30), item("a", 30), item("b", 30), item("d", 30)], 100);
    expect(parts2.map((p) => p.map((i) => i.zipPath))).toEqual([["a", "b", "c"], ["d"]]);
  });

  it("un archivo más grande que el tope va solo", () => {
    const parts = splitIntoParts([item("a", 10), item("b", 500), item("c", 10)], 100);
    expect(parts.map((p) => p.map((i) => i.zipPath))).toEqual([["a"], ["b"], ["c"]]);
  });

  it("sin archivos no hay partes; es determinístico", () => {
    expect(splitIntoParts([])).toEqual([]);
    const items = [item("z", 1), item("y", 1)];
    expect(splitIntoParts(items)).toEqual(splitIntoParts([...items].reverse()));
  });
});

describe("helpers", () => {
  it("safeSegment limpia acentos y caracteres raros para nombres de carpeta", () => {
    expect(safeSegment("Juan Pérez / Ñandú?")).toBe("Juan Perez Nandu");
    expect(safeSegment("../../etc")).toBe("etc");
    expect(safeSegment("..", "x")).toBe("x");
    expect(safeSegment("   ", "cliente")).toBe("cliente");
  });

  it("extOf toma la extensión de la clave", () => {
    expect(extOf("uploads/x/photos/a.JPG")).toBe("jpg");
    expect(extOf("uploads/x/y", "bin")).toBe("bin");
  });

  it("worthReplacing exige al menos 15% de ahorro", () => {
    expect(worthReplacing(1000, 850)).toBe(true);
    expect(worthReplacing(1000, 900)).toBe(false);
    expect(worthReplacing(0, 0)).toBe(false);
  });
});
