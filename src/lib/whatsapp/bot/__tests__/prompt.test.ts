import { describe, it, expect } from "vitest";
import { buildSecurityBlock, buildExamplesBlock, buildStaticSystemText, buildConditionsBlock } from "@/lib/whatsapp/bot/prompt";

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

describe("buildConditionsBlock", () => {
  it("devuelve null sin condiciones", () => {
    expect(buildConditionsBlock(null)).toBeNull();
  });

  it("devuelve null si todos los campos están vacíos", () => {
    expect(buildConditionsBlock({ kmPerDay: null, extraKmRate: null, deductible: null, deductibleReduced: null })).toBeNull();
  });

  it("incluye los campos cargados", () => {
    const block = buildConditionsBlock({ kmPerDay: 200, extraKmRate: 500, deductible: 600000, deductibleReduced: 400000 });
    expect(block).toContain("200 km");
    expect(block).toContain("$500");
    expect(block).toContain("$600000");
    expect(block).toContain("$400000");
  });
});

describe("buildStaticSystemText", () => {
  it("usa un prompt por defecto si viene vacío", () => {
    const text = buildStaticSystemText({ prompt: "", blockedWords: [], escalationWords: [], examples: [], knowledgeBlock: null });
    expect(text.length).toBeGreaterThan(0);
  });

  it("incluye el prompt, la base de conocimiento, las instrucciones de confianza y las de uso de tools", () => {
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
    expect(text).toContain("check_availability");
    expect(text).toContain("get_my_reservations");
  });

  it("incluye las condiciones generales cuando vienen cargadas", () => {
    const text = buildStaticSystemText({
      prompt: "Sos el bot.",
      blockedWords: [],
      escalationWords: [],
      examples: [],
      knowledgeBlock: null,
      conditions: { kmPerDay: 200, extraKmRate: null, deductible: null, deductibleReduced: null },
    });
    expect(text).toContain("200 km");
  });
});
