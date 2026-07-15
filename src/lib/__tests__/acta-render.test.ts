import { describe, it, expect } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";
import { ActaDocument, type ActaData } from "@/lib/acta/pdf";
import { getDictionary } from "@/lib/i18n";
import { COMPANY } from "@/lib/contract";

/**
 * Smoke test del acta: renderiza el PDF completo (incluye el croquis SVG con
 * daños y la sección de conductores autorizados) para asegurar que las
 * primitivas de @react-pdf/renderer no rompen en runtime.
 */
describe("ActaDocument", () => {
  it("renderiza a un PDF con croquis de daños y conductores autorizados", async () => {
    const data: ActaData = {
      kind: "handover",
      dict: getDictionary("es"),
      company: COMPANY,
      dateStr: "14/07/2026 10:00",
      registeredBy: "Empleado Test",
      vehicleLabel: "Toyota Etios",
      plate: "AB123CD",
      clientRows: [{ label: "Cliente", value: "Juan Pérez" }],
      authorizedDrivers: ["Juan Pérez", "María Gómez"],
      termRows: [
        { label: "Total a pagar", value: "$ 100.000" },
        { label: "Seña", value: "$ 30.000" },
        { label: "Forma de garantía", value: "Tarjeta de crédito" },
      ],
      km: 50_000,
      fuelLevel: 10,
      fuelLevels: 12,
      checklist: [
        { label: "Luces", status: "ok" },
        { label: "Frenos", status: "fail" },
      ],
      damages: [
        { view: "top", description: "Rayón puerta", posX: 0.3, posY: 0.4 },
        { view: "top", description: "Golpe paragolpes", posX: 0.6, posY: 0.85 },
      ],
      observations: "Sin novedades.",
      signerName: "Juan Pérez",
      photoDataUris: [],
    };

    const buf = await renderToBuffer(createElement(ActaDocument, data));
    // %PDF header + tamaño razonable.
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.subarray(0, 4).toString()).toBe("%PDF");
  });
});
