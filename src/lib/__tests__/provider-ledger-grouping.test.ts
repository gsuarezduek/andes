import { describe, it, expect } from "vitest";
import { filterThisMonth, groupProviderLedgerByMonth } from "@/lib/provider-ledger-grouping";

// "now" fijo: 17/08/2026 10:00 hora Mendoza (13:00 UTC).
const NOW = new Date("2026-08-17T13:00:00Z");

function row(id: string, isoMendozaWall: string) {
  // isoMendozaWall tipo "2026-08-17T13:00" (hora de pared Mendoza, UTC-3).
  return { id, createdAt: new Date(`${isoMendozaWall}:00-03:00`) };
}

describe("filterThisMonth", () => {
  it("se queda solo con los movimientos del mes calendario actual", () => {
    const rows = [row("a", "2026-08-01T09:00"), row("b", "2026-07-31T23:00"), row("c", "2026-08-17T09:00")];
    expect(filterThisMonth(rows, NOW).map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("sin movimientos, devuelve vacío", () => {
    expect(filterThisMonth([], NOW)).toEqual([]);
  });
});

describe("groupProviderLedgerByMonth", () => {
  it("agrupa el mes actual bajo el nombre del mes sin año", () => {
    const rows = [row("a", "2026-08-01T09:00"), row("b", "2026-08-17T15:00")];
    const groups = groupProviderLedgerByMonth(rows, NOW);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ key: "2026-08", label: "Agosto" });
    expect(groups[0].rows.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("un año distinto al actual suma 'de AAAA'", () => {
    const rows = [row("a", "2025-07-30T09:00")];
    const groups = groupProviderLedgerByMonth(rows, NOW);
    expect(groups[0]).toMatchObject({ label: "Julio de 2025" });
  });

  it("mantiene el orden de entrada y separa por mes sin reordenar", () => {
    const rows = [row("a", "2026-08-05T09:00"), row("b", "2026-07-20T09:00"), row("c", "2026-08-25T09:00")];
    const groups = groupProviderLedgerByMonth(rows, NOW);
    // "c" vuelve a caer en agosto, pero como no es consecutivo con "a" (se
    // intercaló "b" de julio), abre un grupo nuevo en vez de unirse al primero.
    expect(groups.map((g) => g.key)).toEqual(["2026-08", "2026-07", "2026-08"]);
    expect(groups[0].rows.map((r) => r.id)).toEqual(["a"]);
    expect(groups[2].rows.map((r) => r.id)).toEqual(["c"]);
  });

  it("sin movimientos, no genera grupos", () => {
    expect(groupProviderLedgerByMonth([], NOW)).toEqual([]);
  });
});
