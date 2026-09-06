import { describe, it, expect } from "vitest";
import { buildTextResult, MAX_CHARS_PER_DOC } from "@/lib/whatsapp/bot/documents";

describe("buildTextResult", () => {
  it("usa el texto crudo tal cual si entra en el tope", () => {
    const raw = "a".repeat(100);
    expect(buildTextResult(raw, null)).toEqual({ text: raw, truncated: false, summarized: false });
  });

  it("usa el resumen si el crudo se pasa pero el resumen entra", () => {
    const raw = "a".repeat(MAX_CHARS_PER_DOC + 1);
    const summary = "resumen corto";
    expect(buildTextResult(raw, summary)).toEqual({ text: summary, truncated: false, summarized: true });
  });

  it("trunca el crudo si no hay resumen disponible", () => {
    const raw = "a".repeat(MAX_CHARS_PER_DOC + 500);
    const result = buildTextResult(raw, null);
    expect(result.text).toHaveLength(MAX_CHARS_PER_DOC);
    expect(result.truncated).toBe(true);
    expect(result.summarized).toBe(false);
  });

  it("trunca el resumen si el resumen en sí se pasa del tope", () => {
    const raw = "a".repeat(MAX_CHARS_PER_DOC + 500);
    const summary = "b".repeat(MAX_CHARS_PER_DOC + 100);
    const result = buildTextResult(raw, summary);
    expect(result.text).toHaveLength(MAX_CHARS_PER_DOC);
    expect(result.text[0]).toBe("b"); // se truncó el resumen, no el crudo
    expect(result.truncated).toBe(true);
    expect(result.summarized).toBe(true);
  });
});
