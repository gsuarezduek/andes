import { describe, it, expect } from "vitest";
import { buildSecurityBlock, buildExamplesBlock, buildStaticSystemText } from "@/lib/whatsapp/bot/prompt";

describe("buildSecurityBlock", () => {
  it("devuelve null sin ninguna palabra configurada", () => {
    expect(buildSecurityBlock([], [])).toBeNull();
  });

  it("menciona las palabras bloqueadas y las de escalamiento", () => {
    const block = buildSecurityBlock(["descuento"], ["cancelar"]);
    expect(block).toContain("descuento");
    expect(block).toContain("cancelar");
  });
});

describe("buildExamplesBlock", () => {
  it("devuelve null sin ejemplos", () => {
    expect(buildExamplesBlock([])).toBeNull();
  });

  it("incluye pregunta y respuesta de cada ejemplo", () => {
    const block = buildExamplesBlock([{ question: "¿Hacen descuentos?", answer: "No hacemos descuentos." }]);
    expect(block).toContain("¿Hacen descuentos?");
    expect(block).toContain("No hacemos descuentos.");
  });
});

describe("buildStaticSystemText", () => {
  it("usa un prompt por defecto si viene vacío", () => {
    const text = buildStaticSystemText({ prompt: "", blockedWords: [], escalationWords: [], examples: [], knowledgeBlock: null });
    expect(text.length).toBeGreaterThan(0);
  });

  it("incluye el prompt, la base de conocimiento y las instrucciones de confianza", () => {
    const text = buildStaticSystemText({
      prompt: "Sos el bot de MDZ Rent a Car.",
      blockedWords: [],
      escalationWords: [],
      examples: [],
      knowledgeBlock: "Horario: 9 a 18hs.",
    });
    expect(text).toContain("Sos el bot de MDZ Rent a Car.");
    expect(text).toContain("Horario: 9 a 18hs.");
    expect(text).toContain("escalate=true");
  });
});
