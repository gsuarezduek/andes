import { describe, expect, it } from "vitest";
import { categorizeKey, formatBytes } from "../cloud-usage";

describe("categorizeKey", () => {
  it("clasifica cada tipo de archivo por su clave", () => {
    expect(categorizeKey("actas/abc.pdf")).toBe("Actas PDF");
    expect(categorizeKey("uploads/d1/signature.png")).toBe("Firmas");
    expect(categorizeKey("uploads/d1/photos/x.jpg")).toBe("Fotos");
    expect(categorizeKey("uploads/d1/damages/x.jpg")).toBe("Fotos de daños");
    expect(categorizeKey("uploads/d1/videos/x.mp4")).toBe("Videos");
    expect(categorizeKey("uploads/d1/documents/x.jpg")).toBe("Documentos (licencia/DNI)");
    expect(categorizeKey("whatsapp/2026/x.jpg")).toBe("WhatsApp");
    expect(categorizeKey("whatsapp-bot-docs/x.pdf")).toBe("WhatsApp");
    expect(categorizeKey("otra/cosa")).toBe("Otros");
  });
});

describe("formatBytes", () => {
  it("formatea con la unidad adecuada", () => {
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(10 * 1024 ** 3)).toBe("10.0 GB");
  });
});
