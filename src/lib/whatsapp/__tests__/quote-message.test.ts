import { describe, expect, it } from "vitest";
import { DEFAULT_QUOTE_MESSAGE_TEMPLATE, renderQuoteMessage, type QuoteMessageVars } from "@/lib/whatsapp/quote-message";

const vars: QuoteMessageVars = {
  auto: "Chevrolet Onix",
  dias: "3",
  precioDia: "$50.000",
  total: "$150.000",
  condiciones: "Km incluidos por día: 200 km.",
  cliente: " Juan",
};

describe("renderQuoteMessage", () => {
  it("resuelve todos los placeholders de la plantilla default", () => {
    const message = renderQuoteMessage(null, vars);
    expect(message).not.toContain("{");
    expect(message).toContain("Chevrolet Onix");
    expect(message).toContain("3 día(s)");
    expect(message).toContain("$50.000");
    expect(message).toContain("$150.000");
    expect(message).toContain("Km incluidos por día: 200 km.");
    expect(message).toContain("¡Hola Juan!");
  });

  it("usa la plantilla custom cuando está cargada", () => {
    const message = renderQuoteMessage("Auto: {auto} — Total: {total}", vars);
    expect(message).toBe("Auto: Chevrolet Onix — Total: $150.000");
  });

  it("cae al default si la plantilla custom está vacía o es solo espacios", () => {
    expect(renderQuoteMessage("", vars)).toBe(renderQuoteMessage(null, vars));
    expect(renderQuoteMessage("   ", vars)).toBe(renderQuoteMessage(null, vars));
  });

  it("deja sin resolver un placeholder que no esté en vars (no revienta)", () => {
    const message = renderQuoteMessage("Hola {desconocido}, auto {auto}", vars);
    expect(message).toBe("Hola {desconocido}, auto Chevrolet Onix");
  });

  it("DEFAULT_QUOTE_MESSAGE_TEMPLATE no cambia el resultado si se pasa explícito", () => {
    expect(renderQuoteMessage(DEFAULT_QUOTE_MESSAGE_TEMPLATE, vars)).toBe(renderQuoteMessage(null, vars));
  });
});
