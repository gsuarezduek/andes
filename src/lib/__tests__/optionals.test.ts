import { describe, expect, it } from "vitest";
import { parseOptionals, isInsuranceUpgrade, resolveOptionals } from "@/lib/sync/optionals";
import type { RawOptional } from "@/lib/sync/types";

const CATALOG: RawOptional[] = [
  { id: 3, name: "200km extra camionetas", cost: 23000, perDay: false, hasMany: true },
  { id: 4, name: "200km extras autos", cost: 20000, perDay: false, hasMany: false },
  { id: 5, name: "Mejora de Seguro", cost: 20000, perDay: true, hasMany: false },
];

describe("parseOptionals", () => {
  it("parsea id:cantidad;", () => {
    expect(parseOptionals("4:1;5:1;")).toEqual([
      { id: 4, qty: 1 },
      { id: 5, qty: 1 },
    ]);
  });
  it("cantidad ausente = 1 y descarta basura", () => {
    expect(parseOptionals("4;")).toEqual([{ id: 4, qty: 1 }]);
    expect(parseOptionals("")).toEqual([]);
    expect(parseOptionals(null)).toEqual([]);
    expect(parseOptionals("x:1;")).toEqual([]);
  });
});

describe("isInsuranceUpgrade", () => {
  it("detecta por nombre", () => {
    expect(isInsuranceUpgrade("Mejora de Seguro")).toBe(true);
    expect(isInsuranceUpgrade("200km extras autos")).toBe(false);
  });
});

describe("resolveOptionals", () => {
  it("mejora de seguro es flag, no accesorio", () => {
    expect(resolveOptionals("5:1;", CATALOG, 3)).toEqual({
      insuranceUpgrade: true,
      accessoriesDesc: null,
      accessoriesAmount: null,
    });
  });

  it("pack de km fijo → accesorio con importe (no por día)", () => {
    expect(resolveOptionals("4:1;", CATALOG, 5)).toEqual({
      insuranceUpgrade: false,
      accessoriesDesc: "200km extras autos",
      accessoriesAmount: 20000,
    });
  });

  it("mezcla: seguro (flag) + km (accesorio)", () => {
    expect(resolveOptionals("4:1;5:1;", CATALOG, 4)).toEqual({
      insuranceUpgrade: true,
      accessoriesDesc: "200km extras autos",
      accessoriesAmount: 20000,
    });
  });

  it("cantidad > 1 se refleja en descripción e importe", () => {
    expect(resolveOptionals("3:2;", CATALOG, 3)).toEqual({
      insuranceUpgrade: false,
      accessoriesDesc: "200km extra camionetas ×2",
      accessoriesAmount: 46000,
    });
  });

  it("por-día: mejora sería cost×días si fuera accesorio; ids desconocidos se ignoran", () => {
    // id 99 no existe → ignorado; queda solo el pack fijo.
    expect(resolveOptionals("99:1;4:1;", CATALOG, 10)).toEqual({
      insuranceUpgrade: false,
      accessoriesDesc: "200km extras autos",
      accessoriesAmount: 20000,
    });
  });

  it("sin opcionales → todo vacío", () => {
    expect(resolveOptionals(null, CATALOG, 3)).toEqual({
      insuranceUpgrade: false,
      accessoriesDesc: null,
      accessoriesAmount: null,
    });
  });
});
