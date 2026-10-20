import { describe, expect, it } from "vitest";
import { paymentInCurrency, roomPaidTotal } from "../payments";

const d = (s: string) => new Date(`${s}T12:00:00Z`);
const history = [
  { rate: 1400, createdAt: d("2026-09-01") },
  { rate: 1500, createdAt: d("2026-10-01") },
];

describe("paymentInCurrency", () => {
  it("misma moneda: sin conversión", () => {
    expect(paymentInCurrency({ amount: 100, currency: "usd", exchangeRate: null, createdAt: d("2026-10-05") }, "usd", history)).toBe(100);
  });

  it("pesos sobre total en dólares: usa la cotización del cobro", () => {
    expect(paymentInCurrency({ amount: 153500, currency: "ars", exchangeRate: 1535, createdAt: d("2026-10-05") }, "usd", history)).toBe(100);
  });

  it("sin cotización guardada: usa la de referencia a la fecha del cobro", () => {
    expect(paymentInCurrency({ amount: 140000, currency: "ars", exchangeRate: null, createdAt: d("2026-09-15") }, "usd", history)).toBe(100);
  });

  it("dólares sobre total en pesos: multiplica", () => {
    expect(paymentInCurrency({ amount: 10, currency: "usd", exchangeRate: 1535, createdAt: d("2026-10-05") }, "ars", history)).toBe(15350);
  });

  it("sin ningún valor de referencia: null", () => {
    expect(paymentInCurrency({ amount: 1000, currency: "ars", exchangeRate: null, createdAt: d("2026-10-05") }, "usd", [])).toBeNull();
  });
});

describe("roomPaidTotal", () => {
  it("suma convirtiendo y cuenta lo que no pudo convertir", () => {
    const r = roomPaidTotal(
      [
        { amount: 50, currency: "usd", exchangeRate: null, createdAt: d("2026-10-05") },
        { amount: 153500, currency: "ars", exchangeRate: 1535, createdAt: d("2026-10-05") },
      ],
      "usd",
      history,
    );
    expect(r).toEqual({ paid: 150, unconverted: 0 });
    expect(roomPaidTotal([{ amount: 1000, currency: "ars", exchangeRate: null, createdAt: d("2026-10-05") }], "usd", [])).toEqual({
      paid: 0,
      unconverted: 1,
    });
  });
});
