import { describe, it, expect } from "vitest";
import {
  buildConditionSnapshot,
  currentOwnerContract,
  missingConditionCount,
  normalizeOwnerContractText,
  ORIGINAL_OWNER_CONTRACT_TEXT,
  ownerContractStatus,
  parseClauses,
  validateOwnerContractStep,
  type OwnerContractDraft,
} from "@/lib/owner-contract";

const COMPLETE_RESPONSES = { general: "good", body: "clean", windshield: "ok", upholstery: "ok" };

const draft: OwnerContractDraft = {
  ownerName: "Ana Pérez",
  ownerDocNumber: "30111222",
  ownerAddress: "San Martín 100",
  ownerEmail: "",
  ownerPhone: "",
  place: "Mendoza",
  startDate: "2026-11-02",
  startTime: "09:00",
  endDate: "2027-11-02",
  endTime: "09:00",
  commercialTerms: "",
  km: "1000",
  fuelLevel: 8,
  responses: COMPLETE_RESPONSES,
  observations: "",
  companySignerName: "Gastón",
};

describe("parseClauses", () => {
  it("separa títulos, párrafos y listas", () => {
    expect(parseClauses("USO\nEl vehículo se alquila.\n\nMDZ se compromete a:\n- Una cosa\n- Otra cosa\n\nCierre.")).toEqual([
      { kind: "heading", text: "USO" },
      { kind: "paragraph", text: "El vehículo se alquila." },
      { kind: "paragraph", text: "MDZ se compromete a:" },
      { kind: "list", items: ["Una cosa", "Otra cosa"] },
      { kind: "paragraph", text: "Cierre." },
    ]);
  });

  it("no toma como título un párrafo que solo arranca en mayúsculas", () => {
    expect(parseClauses("MDZ RENT A CAR se obliga.")).toEqual([{ kind: "paragraph", text: "MDZ RENT A CAR se obliga." }]);
  });

  it("entiende el texto original: títulos con tilde y la lista de compromisos", () => {
    const blocks = parseClauses(ORIGINAL_OWNER_CONTRACT_TEXT.body);
    expect(blocks).toContainEqual({ kind: "heading", text: "JURISDICCIÓN" });
    const list = blocks.find((b) => b.kind === "list");
    expect(list && list.kind === "list" ? list.items : []).toHaveLength(3);
  });
});

describe("normalizeOwnerContractText", () => {
  it("exige título y texto", () => {
    expect(normalizeOwnerContractText({ title: " ", body: "x" }).ok).toBe(false);
    expect(normalizeOwnerContractText({ title: "x", body: " \n " }).ok).toBe(false);
  });

  it("dos textos que solo difieren en espacios quedan iguales", () => {
    const a = normalizeOwnerContractText({ title: " T ", body: "A\r\n\r\n\r\nB " });
    expect(a).toEqual({ ok: true, value: { title: "T", body: "A\n\nB" } });
  });
});

describe("estado del vehículo", () => {
  it("cuenta solo las opciones sin elegir: las tildes pueden quedar sin marcar", () => {
    expect(missingConditionCount({})).toBe(4);
    expect(missingConditionCount(COMPLETE_RESPONSES)).toBe(0);
    expect(missingConditionCount({ ...COMPLETE_RESPONSES, general: "inventado" })).toBe(1);
  });

  it("el snapshot guarda qué opción se marcó y también las que no", () => {
    const snapshot = buildConditionSnapshot({ ...COMPLETE_RESPONSES, greenCard: true });
    const general = snapshot.find((g) => g.title === "Estado general")!;
    expect(general.lines[0]).toEqual([
      { label: "Excelente", selected: false },
      { label: "Bueno", selected: true },
      { label: "Regular", selected: false },
    ]);
    const docs = snapshot.find((g) => g.title === "Accesorios y documentación")!.lines.flat();
    expect(docs.find((o) => o.label === "Tarjeta verde")?.selected).toBe(true);
    expect(docs.find((o) => o.label === "Matafuego")?.selected).toBe(false);
  });
});

describe("vigencia", () => {
  const contract = { startsAt: new Date("2026-01-01"), endsAt: new Date("2027-01-01"), voidedAt: null as Date | null };

  it("distingue por fechas y la baja gana siempre", () => {
    expect(ownerContractStatus(contract, new Date("2025-12-31"))).toBe("upcoming");
    expect(ownerContractStatus(contract, new Date("2026-06-01"))).toBe("active");
    expect(ownerContractStatus(contract, new Date("2027-01-01"))).toBe("expired");
    expect(ownerContractStatus({ ...contract, voidedAt: new Date("2026-02-01") }, new Date("2026-06-01"))).toBe("voided");
  });

  it("con dos vigentes elige el que termina más tarde; dado de baja no cuenta", () => {
    const later = { ...contract, endsAt: new Date("2028-01-01") };
    const voided = { ...contract, endsAt: new Date("2029-01-01"), voidedAt: new Date("2026-02-01") };
    expect(currentOwnerContract([contract, later, voided], new Date("2026-06-01"))).toBe(later);
    expect(currentOwnerContract([voided], new Date("2026-06-01"))).toBeNull();
  });
});

describe("validateOwnerContractStep", () => {
  it("acepta un borrador completo en todos los pasos", () => {
    for (let step = 0; step < 5; step++) expect(validateOwnerContractStep(step, draft)).toBeNull();
  });

  it("pide los datos obligatorios del propietario; email y teléfono son opcionales", () => {
    expect(validateOwnerContractStep(0, { ...draft, ownerDocNumber: " " })).toMatch(/documento/);
    expect(validateOwnerContractStep(0, { ...draft, ownerEmail: "no-es-email" })).toMatch(/email/);
  });

  it("el fin tiene que ser posterior al inicio, mirando también la hora", () => {
    expect(validateOwnerContractStep(1, { ...draft, endDate: "2026-11-02", endTime: "09:00" })).toMatch(/posterior/);
    expect(validateOwnerContractStep(1, { ...draft, endDate: "2026-11-02", endTime: "09:01" })).toBeNull();
    expect(validateOwnerContractStep(1, { ...draft, endDate: "" })).toMatch(/fin/);
  });

  it("exige el km y todas las opciones del estado", () => {
    expect(validateOwnerContractStep(2, { ...draft, km: "" })).toMatch(/kilometraje/);
    expect(validateOwnerContractStep(2, { ...draft, responses: {} })).toMatch(/4 puntos/);
  });
});
