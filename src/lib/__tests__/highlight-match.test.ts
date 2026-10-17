import { describe, expect, it } from "vitest";
import { splitByMatch } from "@/lib/highlight-match";

describe("splitByMatch", () => {
  it("sin query, devuelve el texto entero sin match", () => {
    expect(splitByMatch("Hola mundo", "")).toEqual([{ text: "Hola mundo", match: false }]);
  });

  it("encuentra una coincidencia sin distinguir mayúsculas", () => {
    expect(splitByMatch("Hola Mundo", "mundo")).toEqual([
      { text: "Hola ", match: false },
      { text: "Mundo", match: true },
    ]);
  });

  it("encuentra varias coincidencias", () => {
    expect(splitByMatch("km km km", "km")).toEqual([
      { text: "km", match: true },
      { text: " ", match: false },
      { text: "km", match: true },
      { text: " ", match: false },
      { text: "km", match: true },
    ]);
  });

  it("sin coincidencias, devuelve el texto entero sin match", () => {
    expect(splitByMatch("Hola mundo", "xyz")).toEqual([{ text: "Hola mundo", match: false }]);
  });
});
