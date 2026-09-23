import { describe, it, expect } from "vitest";
import { linkifyText, shortenUrlLabel } from "@/lib/linkify";

describe("shortenUrlLabel", () => {
  it("muestra dominio + path sin protocolo ni www", () => {
    expect(shortenUrlLabel("https://www.mdzrentacar.com/reservas")).toBe("mdzrentacar.com/reservas");
  });

  it("recorta con elipsis si supera el largo máximo", () => {
    const long = "https://mdzrentacar.com/reservas/una-ruta-muy-larga-de-verdad-che";
    const label = shortenUrlLabel(long, 20);
    expect(label.length).toBe(20);
    expect(label.endsWith("…")).toBe(true);
  });

  it("no rompe con una URL que el parser nativo no acepta", () => {
    expect(shortenUrlLabel("http://")).toBeTruthy();
  });
});

describe("linkifyText", () => {
  it("texto sin URL queda como un solo segmento de texto", () => {
    expect(linkifyText("hola, ¿cómo estás?")).toEqual([{ type: "text", text: "hola, ¿cómo estás?" }]);
  });

  it("detecta una URL con protocolo en medio del texto", () => {
    const segments = linkifyText("mirá esto: https://mdzrentacar.com/x gracias");
    expect(segments).toEqual([
      { type: "text", text: "mirá esto: " },
      { type: "link", href: "https://mdzrentacar.com/x", label: "mdzrentacar.com/x" },
      { type: "text", text: " gracias" },
    ]);
  });

  it("detecta un dominio con www sin protocolo y le agrega https:// al href", () => {
    const segments = linkifyText("www.mdzrentacar.com");
    expect(segments).toEqual([{ type: "link", href: "https://www.mdzrentacar.com", label: "mdzrentacar.com" }]);
  });

  it("no incluye puntuación de cierre en el link", () => {
    const segments = linkifyText("(mirá https://mdzrentacar.com/x).");
    expect(segments).toEqual([
      { type: "text", text: "(mirá " },
      { type: "link", href: "https://mdzrentacar.com/x", label: "mdzrentacar.com/x" },
      { type: "text", text: ")." },
    ]);
  });

  it("soporta varios links en el mismo mensaje", () => {
    const segments = linkifyText("https://a.com y también https://b.com");
    expect(segments).toEqual([
      { type: "link", href: "https://a.com", label: "a.com" },
      { type: "text", text: " y también " },
      { type: "link", href: "https://b.com", label: "b.com" },
    ]);
  });
});
