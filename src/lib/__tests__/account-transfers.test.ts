import { describe, expect, it } from "vitest";
import {
  applyTransfersToBalances,
  bitcoinBalances,
  safeDeltaFromTransfers,
  walletDeltaFromTransfers,
} from "@/lib/account-transfers";
import { emptyCurrencyTotals } from "@/lib/currency";

const base = { fromAmount: 0, fromCurrency: "ars", toAmount: 0, toCurrency: "ars" } as const;

describe("applyTransfersToBalances", () => {
  it("resta del origen y suma al destino", () => {
    const balances = new Map([["a", { ars: 1000, usd: 0 }], ["b", emptyCurrencyTotals()]]);
    const resolve = new Map([["a", "a"], ["b", "b"]]);
    applyTransfersToBalances(balances, resolve, [
      { ...base, fromAccountId: "a", fromAmount: 300, toAccountId: "b", toAmount: 300 },
    ]);
    expect(balances.get("a")).toEqual({ ars: 700, usd: 0 });
    expect(balances.get("b")).toEqual({ ars: 300, usd: 0 });
  });

  it("con monedas distintas cada lado usa su moneda y su monto", () => {
    const balances = new Map([["a", { ars: 120000, usd: 0 }], ["b", emptyCurrencyTotals()]]);
    const resolve = new Map([["a", "a"], ["b", "b"]]);
    applyTransfersToBalances(balances, resolve, [
      { fromAccountId: "a", fromAmount: 120000, fromCurrency: "ars", toAccountId: "b", toAmount: 100, toCurrency: "usd" },
    ]);
    expect(balances.get("a")).toEqual({ ars: 0, usd: 0 });
    expect(balances.get("b")).toEqual({ ars: 0, usd: 100 });
  });

  it("entre subcuentas de la misma principal no cambia el saldo agrupado", () => {
    const balances = new Map([["a", { ars: 500, usd: 0 }]]);
    const resolve = new Map([["a", "a"], ["a2", "a"]]);
    applyTransfersToBalances(balances, resolve, [
      { ...base, fromAccountId: "a2", fromAmount: 200, toAccountId: "a", toAmount: 200 },
    ]);
    expect(balances.get("a")).toEqual({ ars: 500, usd: 0 });
  });
});

describe("walletDeltaFromTransfers", () => {
  it("de efectivo a banco baja la billetera", () => {
    const d = walletDeltaFromTransfers([
      { ...base, fromAccountId: "e", fromAmount: 100, toAccountId: "b", toAmount: 100, fromIsCash: true, toIsCash: false },
    ]);
    expect(d).toEqual({ ars: -100, usd: 0 });
  });
  it("de banco a efectivo la sube; entre cuentas no-efectivo no la mueve", () => {
    const d = walletDeltaFromTransfers([
      { ...base, fromAccountId: "b", fromAmount: 50, toAccountId: "e", toAmount: 50, fromIsCash: false, toIsCash: true },
      { ...base, fromAccountId: "b", fromAmount: 999, toAccountId: "c", toAmount: 999, fromIsCash: false, toIsCash: false },
    ]);
    expect(d).toEqual({ ars: 50, usd: 0 });
  });
});

describe("caja fuerte como extremo de un traspaso", () => {
  it("los traspasos hacia la caja fuerte suman y desde ella restan", () => {
    const d = safeDeltaFromTransfers([
      { ...base, fromAccountId: "e", fromAmount: 300, toAccountId: null, toAmount: 300 },
      { ...base, fromAccountId: null, fromAmount: 50, toAccountId: "e", toAmount: 50 },
      { ...base, fromAccountId: "b", fromAmount: 999, toAccountId: "e", toAmount: 999 },
    ]);
    expect(d).toEqual({ ars: 250, usd: 0 });
  });

  it("un traspaso a la caja fuerte baja la cuenta de origen pero no toca ninguna cuenta destino", () => {
    const balances = new Map([["e", { ars: 1000, usd: 0 }]]);
    const resolve = new Map([["e", "e"]]);
    applyTransfersToBalances(balances, resolve, [
      { ...base, fromAccountId: "e", fromAmount: 400, toAccountId: null, toAmount: 400 },
    ]);
    expect(balances.get("e")).toEqual({ ars: 600, usd: 0 });
  });
});

describe("cuentas Bitcoin", () => {
  const resolve = new Map([["usd", "usd"], ["btc", "btc"]]);
  const buy = {
    fromAccountId: "usd",
    fromAmount: 7400,
    fromCurrency: "usd",
    toAccountId: "btc",
    toAmount: 0.1,
    toCurrency: "btc",
  } as const;
  const sell = {
    fromAccountId: "btc",
    fromAmount: 0.1,
    fromCurrency: "btc",
    toAccountId: "usd",
    toAmount: 10000,
    toCurrency: "usd",
  } as const;

  it("el lado en BTC no toca los saldos en pesos/dólares", () => {
    const balances = new Map([["usd", { ars: 0, usd: 10000 }]]);
    applyTransfersToBalances(balances, resolve, [buy]);
    expect(balances.get("usd")).toEqual({ ars: 0, usd: 2600 });
  });

  it("comprar suma BTC y lo aportado; vender resta BTC y descuenta lo recibido", () => {
    const afterBuy = bitcoinBalances(["btc"], resolve, [buy]).get("btc");
    expect(afterBuy).toEqual({ btc: 0.1, netContributed: { ars: 0, usd: 7400 } });

    // Vendido todo con ganancia: 0 BTC y aportado negativo (se sacó más de lo que se puso).
    const afterSell = bitcoinBalances(["btc"], resolve, [buy, sell]).get("btc");
    expect(afterSell?.btc).toBeCloseTo(0, 8);
    expect(afterSell?.netContributed).toEqual({ ars: 0, usd: -2600 });
  });

  it("ignora traspasos que no tocan la cuenta Bitcoin", () => {
    const result = bitcoinBalances(["btc"], resolve, [
      { fromAccountId: "usd", fromAmount: 5, fromCurrency: "usd", toAccountId: null, toAmount: 5, toCurrency: "usd" },
    ]);
    expect(result.get("btc")).toEqual({ btc: 0, netContributed: { ars: 0, usd: 0 } });
  });

  it("la Billetera y la Caja fuerte ignoran el lado en BTC", () => {
    expect(walletDeltaFromTransfers([{ ...buy, fromIsCash: true, toIsCash: false }])).toEqual({ ars: 0, usd: -7400 });
    expect(safeDeltaFromTransfers([{ ...buy, fromAccountId: null }])).toEqual({ ars: 0, usd: -7400 });
  });
});
