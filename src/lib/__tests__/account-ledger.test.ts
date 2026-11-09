import { describe, expect, it } from "vitest";
import { accountLedgerTotals, buildAccountLedgerEntries } from "@/lib/account-ledger";
import type { CashMovementRow } from "@/lib/cash";
import type { AccountTransferRow } from "@/lib/account-transfers-queries";

const at = (iso: string) => new Date(iso);

function movement(id: string, type: "income" | "expense", amount: number, createdAt: Date): CashMovementRow {
  return { id, type, amount, currency: "ars", createdAt } as CashMovementRow;
}

function transfer(
  id: string,
  from: string | null,
  to: string | null,
  amounts: Partial<AccountTransferRow>,
  createdAt: Date,
): AccountTransferRow {
  return {
    id,
    fromAccountId: from,
    fromAccountName: from ?? "Caja fuerte",
    fromAmount: 0,
    fromCurrency: "ars",
    toAccountId: to,
    toAccountName: to ?? "Caja fuerte",
    toAmount: 0,
    toCurrency: "ars",
    description: "",
    createdByName: "QA",
    createdAt,
    masked: false,
    ...amounts,
  };
}

describe("buildAccountLedgerEntries", () => {
  it("mezcla movimientos y traspasos por fecha, más reciente primero, con el sentido desde la cuenta", () => {
    const entries = buildAccountLedgerEntries(
      [movement("m1", "income", 1000, at("2026-11-01T12:00:00Z"))],
      [
        transfer("t1", "a", "b", { fromAmount: 300, toAmount: 300 }, at("2026-11-03T12:00:00Z")),
        transfer("t2", "b", "a", { fromAmount: 50, toAmount: 50 }, at("2026-11-02T12:00:00Z")),
      ],
      ["a"],
    );
    expect(entries.map((e) => (e.kind === "movement" ? e.movement.id : `${e.transfer.id}:${e.direction}`))).toEqual([
      "t1:out",
      "t2:in",
      "m1",
    ]);
  });

  it("un traspaso entre la cuenta y una subcuenta aparece de los dos lados", () => {
    const entries = buildAccountLedgerEntries(
      [],
      [transfer("t", "a", "a2", { fromAmount: 10, toAmount: 10 }, at("2026-11-01T12:00:00Z"))],
      ["a", "a2"],
    );
    expect(entries.map((e) => (e.kind === "transfer" ? e.direction : ""))).toEqual(["out", "in"]);
  });
});

describe("accountLedgerTotals", () => {
  it("suma traspasos con el monto del lado de la cuenta (cambio de moneda incluido) e ignora el lado BTC", () => {
    const entries = buildAccountLedgerEntries(
      [movement("m1", "income", 1000, at("2026-11-01T12:00:00Z")), movement("m2", "expense", 200, at("2026-11-02T12:00:00Z"))],
      [
        // Sale de la cuenta: $ 120.000 → US$ 100 en otra.
        transfer("t1", "a", "b", { fromAmount: 120000, fromCurrency: "ars", toAmount: 100, toCurrency: "usd" }, at("2026-11-03T12:00:00Z")),
        // Entra a la cuenta: venta de BTC.
        transfer("t2", "btc", "a", { fromAmount: 0.1, fromCurrency: "btc", toAmount: 10000, toCurrency: "usd" }, at("2026-11-04T12:00:00Z")),
      ],
      ["a"],
    );
    expect(accountLedgerTotals(entries)).toEqual({
      income: { ars: 1000, usd: 10000 },
      expense: { ars: 120200, usd: 0 },
    });
  });
});
