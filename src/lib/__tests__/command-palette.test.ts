import { describe, expect, it } from "vitest";
import { filterCommands, getCommands, normalizeSearch } from "@/lib/command-palette";

describe("getCommands", () => {
  it("el empleado no ve destinos de admin", () => {
    const hrefs = getCommands(false).map((c) => c.href);
    expect(hrefs).toContain("/rentals");
    expect(hrefs).not.toContain("/reports");
    expect(hrefs).not.toContain("/settings");
    expect(hrefs).not.toContain("/users");
  });

  it("el admin ve todo", () => {
    const hrefs = getCommands(true).map((c) => c.href);
    expect(hrefs).toContain("/reports");
    expect(hrefs).toContain("/settings/cloud/cleanup");
  });

  it("no hay ids ni rutas repetidas", () => {
    const all = getCommands(true);
    expect(new Set(all.map((c) => c.id)).size).toBe(all.length);
    expect(new Set(all.map((c) => c.href)).size).toBe(all.length);
  });
});

describe("normalizeSearch", () => {
  it("saca tildes y pasa a minúsculas", () => {
    expect(normalizeSearch("  Vehículos ")).toBe("vehiculos");
  });
});

describe("filterCommands", () => {
  const admin = getCommands(true);

  it("sin consulta devuelve el catálogo completo, en su orden", () => {
    expect(filterCommands(admin, "")).toEqual(admin);
    expect(filterCommands(admin, "   ")).toEqual(admin);
  });

  it("ignora tildes y mayúsculas", () => {
    expect(filterCommands(admin, "vehiculos")[0].href).toBe("/vehicles");
    expect(filterCommands(admin, "CONFIGURACION")[0].href).toBe("/settings");
  });

  it("encuentra por sinónimo", () => {
    expect(filterCommands(admin, "plata")[0].href).toBe("/caja");
    expect(filterCommands(admin, "chakra")[0].href).toBe("/settings/whatsapp");
  });

  it("el título pesa más que un sinónimo", () => {
    // "whatsapp" es título de la sección y también aparece en Configuración.
    const results = filterCommands(admin, "whatsapp");
    expect(results[0].href).toBe("/whatsapp");
    expect(results.map((c) => c.href)).toContain("/settings/whatsapp/bot");
  });

  it("exige todos los términos", () => {
    const results = filterCommands(admin, "bot whatsapp");
    expect(results.map((c) => c.href)).toEqual(["/settings/whatsapp/bot"]);
  });

  it("sin coincidencias devuelve vacío", () => {
    expect(filterCommands(admin, "zzzz")).toEqual([]);
  });

  it("un empleado no encuentra lo de admin ni por sinónimo", () => {
    expect(filterCommands(getCommands(false), "reportes")).toEqual([]);
  });
});
