import { describe, it, expect } from "vitest";
import { pickCheapestPerCategory } from "../engine";

type Item = { id: string; categoryId: string | null; price: number | null };

describe("pickCheapestPerCategory", () => {
  it("elige el más barato entre dos autos de la misma categoría", () => {
    const items: Item[] = [
      { id: "a", categoryId: "suv", price: 90000 },
      { id: "b", categoryId: "suv", price: 75000 },
    ];
    const best = pickCheapestPerCategory(items);
    expect(best.get("suv")?.id).toBe("b");
  });

  it("categorías distintas quedan separadas", () => {
    const items: Item[] = [
      { id: "a", categoryId: "economico", price: 50000 },
      { id: "b", categoryId: "suv", price: 90000 },
    ];
    const best = pickCheapestPerCategory(items);
    expect(best.size).toBe(2);
    expect(best.get("economico")?.id).toBe("a");
    expect(best.get("suv")?.id).toBe("b");
  });

  it("ignora ítems sin categoría resuelta", () => {
    const items: Item[] = [{ id: "a", categoryId: null, price: 50000 }];
    expect(pickCheapestPerCategory(items).size).toBe(0);
  });

  it("ignora ítems sin precio resuelto (needs_review)", () => {
    const items: Item[] = [{ id: "a", categoryId: "suv", price: null }];
    expect(pickCheapestPerCategory(items).size).toBe(0);
  });

  it("sin ítems → mapa vacío", () => {
    expect(pickCheapestPerCategory([]).size).toBe(0);
  });
});
