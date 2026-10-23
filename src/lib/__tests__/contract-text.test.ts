import { describe, it, expect } from "vitest";
import {
  contractTextsFromVersion,
  defaultContractFields,
  defaultContractText,
  joinParagraphs,
  normalizeContractInput,
  sameContract,
  splitParagraphs,
} from "@/lib/contract-text";
import { getDictionary } from "@/lib/i18n";

describe("splitParagraphs", () => {
  it("separa cláusulas por línea en blanco y recorta espacios", () => {
    expect(splitParagraphs("  Uno.  \n\n  Dos.\n\n\n\nTres. ")).toEqual(["Uno.", "Dos.", "Tres."]);
  });

  it("respeta los saltos de línea simples dentro de una cláusula", () => {
    expect(splitParagraphs("Línea 1\nLínea 2\n\nOtra")).toEqual(["Línea 1\nLínea 2", "Otra"]);
  });

  it("acepta CRLF y líneas 'en blanco' con espacios", () => {
    expect(splitParagraphs("Uno.\r\n  \r\nDos.")).toEqual(["Uno.", "Dos."]);
  });

  it("devuelve vacío si no hay texto", () => {
    expect(splitParagraphs("   \n\n  ")).toEqual([]);
  });

  it("es inverso de joinParagraphs", () => {
    const ps = ["Uno.", "Dos\ncon salto.", "Tres."];
    expect(splitParagraphs(joinParagraphs(ps))).toEqual(ps);
  });
});

describe("defaultContractText", () => {
  it("incluye las cláusulas, el consentimiento de fotos, la jurisdicción y la aceptación, en ese orden", () => {
    const legal = getDictionary("es").legal;
    const t = defaultContractText("es");
    expect(t.title).toBe(legal.title);
    expect(t.paragraphs).toEqual([...legal.paragraphs, legal.photoConsent, legal.jurisdiction, legal.acceptance]);
  });

  it("sobrevive el ida y vuelta por la base sin cambiar una coma", () => {
    const texts = contractTextsFromVersion(defaultContractFields());
    expect(texts.es).toEqual(defaultContractText("es"));
    expect(texts.en).toEqual(defaultContractText("en"));
  });
});

describe("normalizeContractInput", () => {
  const valid = { esTitle: " Condiciones ", esBody: "A.\n\n\nB. ", enTitle: "Terms", enBody: "A." };

  it("normaliza el título y deja un único separador entre cláusulas", () => {
    const r = normalizeContractInput(valid);
    expect(r).toEqual({ ok: true, value: { esTitle: "Condiciones", esBody: "A.\n\nB.", enTitle: "Terms", enBody: "A." } });
  });

  it("exige título y texto en los dos idiomas", () => {
    expect(normalizeContractInput({ ...valid, esTitle: " " }).ok).toBe(false);
    expect(normalizeContractInput({ ...valid, esBody: "\n\n" }).ok).toBe(false);
    expect(normalizeContractInput({ ...valid, enTitle: "" }).ok).toBe(false);
    expect(normalizeContractInput({ ...valid, enBody: "" }).ok).toBe(false);
  });

  it("dos textos que solo difieren en espacios cuentan como el mismo contrato", () => {
    const a = normalizeContractInput(valid);
    const b = normalizeContractInput({ ...valid, esBody: "A.  \n\nB." });
    expect(a.ok && b.ok && sameContract(a.value, b.value)).toBe(true);
  });
});
