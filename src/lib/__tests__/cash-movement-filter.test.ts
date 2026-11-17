import { describe, expect, it } from "vitest";
import {
  NO_CATEGORY,
  cashExportFilterSearch,
  expandAccountIds,
  filterCashMovements,
  parseCashExportFilter,
} from "@/lib/cash-movement-filter";

const row = (id: string, paymentMethodId: string | null, recipient: string | null = null, categoryId: string | null = null) => ({
  id,
  paymentMethodId,
  recipientPaymentMethodId: recipient,
  categoryId,
});

const data = {
  incomes: [row("i-cash", "cash"), row("i-debit", "debit"), row("i-credit", "credit"), row("i-mp", "mp")],
  expenses: [
    row("e-cash-fuel", "cash", null, "fuel"),
    row("e-mp-provider", "mp", "provider", null),
    row("e-cash-provider-sub", "cash", "provider-sub", "repairs"),
  ],
};
const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

describe("expandAccountIds", () => {
  const methods = [
    { id: "provider" },
    { id: "provider-sub", parentId: "provider" },
    { id: "cash" },
  ];
  it("suma las subcuentas de una principal", () => {
    expect(expandAccountIds(["provider"], methods).sort()).toEqual(["provider", "provider-sub"]);
  });
  it("una subcuenta no sube a la principal", () => {
    expect(expandAccountIds(["provider-sub"], methods)).toEqual(["provider-sub"]);
  });
  it("sin selección = todas", () => {
    expect(expandAccountIds([], methods)).toEqual([]);
  });
});

describe("filterCashMovements", () => {
  it("sin filtros devuelve todo", () => {
    const r = filterCashMovements(data, { accountIds: [] });
    expect(r.incomes).toHaveLength(4);
    expect(r.expenses).toHaveLength(3);
  });

  it("varias cuentas a la vez (solo tarjetas)", () => {
    const r = filterCashMovements(data, { accountIds: ["debit", "credit"] });
    expect(ids(r.incomes)).toEqual(["i-debit", "i-credit"]);
    expect(r.expenses).toEqual([]);
  });

  it("un egreso matchea por origen o por destino", () => {
    const r = filterCashMovements(data, { accountIds: ["provider", "provider-sub"] });
    expect(ids(r.expenses)).toEqual(["e-mp-provider", "e-cash-provider-sub"]);
  });

  it("solo ingresos / solo egresos", () => {
    expect(filterCashMovements(data, { accountIds: ["cash"], type: "income" }).expenses).toEqual([]);
    const onlyExpenses = filterCashMovements(data, { accountIds: ["cash"], type: "expense" });
    expect(onlyExpenses.incomes).toEqual([]);
    expect(ids(onlyExpenses.expenses)).toEqual(["e-cash-fuel", "e-cash-provider-sub"]);
  });

  it("la categoría filtra solo egresos", () => {
    const r = filterCashMovements(data, { accountIds: [], categoryId: "fuel" });
    expect(r.incomes).toHaveLength(4);
    expect(ids(r.expenses)).toEqual(["e-cash-fuel"]);
    expect(ids(filterCashMovements(data, { accountIds: [], categoryId: NO_CATEGORY }).expenses)).toEqual([
      "e-mp-provider",
    ]);
  });
});

describe("query string del export", () => {
  it("ida y vuelta", () => {
    const filter = { accountIds: ["debit", "credit"], categoryId: "fuel", type: "expense" as const };
    expect(parseCashExportFilter(new URLSearchParams(cashExportFilterSearch(filter)))).toEqual(filter);
  });
  it("sin filtros no agrega nada y un tipo raro cae a todos", () => {
    expect(cashExportFilterSearch({ accountIds: [] })).toBe("");
    expect(parseCashExportFilter(new URLSearchParams("type=foo")).type).toBe("all");
  });
});
