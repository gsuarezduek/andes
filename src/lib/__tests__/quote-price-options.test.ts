import { describe, expect, it } from "vitest";
import { formatArs } from "@/lib/contract";
import {
  formatPriceOptionsBlock,
  formatPriceOptionsInline,
  joinMethods,
  priceOptionLabel,
  quotePriceOptions,
} from "../quote-price-options";

const transfer = { name: "Transferencia Argentina", value: -5, unit: "percent" as const };
const crypto = { name: "Cripto", value: -5, unit: "percent" as const };

describe("quotePriceOptions", () => {
  it("sin ajustes, solo el precio de lista", () => {
    expect(quotePriceOptions(213_000, 3, [])).toEqual([
      { kind: "list", methods: [], adjustmentLabel: null, total: 213_000, perDay: 71_000 },
    ]);
  });

  it("agrupa los medios con el mismo descuento y deja el de lista para el resto", () => {
    const options = quotePriceOptions(213_000, 3, [transfer, crypto]);
    expect(options).toEqual([
      {
        kind: "discount",
        methods: ["Transferencia Argentina", "Cripto"],
        adjustmentLabel: "−5 %",
        total: 202_350,
        perDay: 67_450,
      },
      { kind: "list", methods: [], adjustmentLabel: null, total: 213_000, perDay: 71_000 },
    ]);
  });

  it("ordena descuentos, lista y recargos; soporta montos fijos", () => {
    const options = quotePriceOptions(100_000, 1, [
      { name: "Stripe", value: 3, unit: "percent" },
      { name: "Efectivo", value: -2_000, unit: "fixed" },
      transfer,
    ]);
    expect(options.map((o) => [o.kind, o.total, o.adjustmentLabel])).toEqual([
      ["discount", 95_000, "−5 %"],
      ["discount", 98_000, `−${formatArs(2_000)}`],
      ["list", 100_000, null],
      ["charge", 103_000, "+3 %"],
    ]);
  });

  it("ignora ajustes en cero y no deja un total negativo", () => {
    expect(quotePriceOptions(1_000, 1, [{ name: "X", value: 0, unit: "percent" }])).toHaveLength(1);
    expect(quotePriceOptions(1_000, 1, [{ name: "X", value: -5_000, unit: "fixed" }])[0]!.total).toBe(0);
  });
});

describe("textos", () => {
  it("une los medios con coma y 'o'", () => {
    expect(joinMethods(["A"])).toBe("A");
    expect(joinMethods(["A", "B", "C"])).toBe("A, B o C");
  });

  it("arma la línea y el bloque del mensaje de WhatsApp", () => {
    const options = quotePriceOptions(213_000, 3, [transfer, crypto]);
    expect(priceOptionLabel(options[0]!)).toBe("con Transferencia Argentina o Cripto (−5 %)");
    expect(formatPriceOptionsInline(options, "total")).toBe(
      `${formatArs(202_350)} con Transferencia Argentina o Cripto (−5 %) · ${formatArs(213_000)} con otros medios de pago`,
    );
    expect(formatPriceOptionsBlock(options)).toBe(
      [
        `💰 Con Transferencia Argentina o Cripto (−5 %): ${formatArs(67_450)} por día · Total ${formatArs(202_350)}`,
        `💳 Con otros medios de pago: ${formatArs(71_000)} por día · Total ${formatArs(213_000)}`,
      ].join("\n"),
    );
  });

  it("sin descuentos, el mensaje queda como siempre", () => {
    const options = quotePriceOptions(213_000, 3, []);
    expect(formatPriceOptionsInline(options, "perDay")).toBe(formatArs(71_000));
    expect(formatPriceOptionsBlock(options)).toBe(`💰 Precio por día: ${formatArs(71_000)}\n💵 Total: ${formatArs(213_000)}`);
  });
});
