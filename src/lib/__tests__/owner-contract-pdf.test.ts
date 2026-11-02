import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import { OwnerContractDocument } from "@/lib/owner-contract-pdf";
import { buildConditionSnapshot, ORIGINAL_OWNER_CONTRACT_TEXT } from "@/lib/owner-contract";

describe("OwnerContractDocument", () => {
  it("genera un PDF con datos mínimos, sin firmas ni datos opcionales", async () => {
    const logo = readFileSync(path.join(process.cwd(), "public", "brand", "mdz-logo-bw.png"));
    const element = createElement(OwnerContractDocument, {
      logoDataUri: `data:image/png;base64,${logo.toString("base64")}`,
      number: 1,
      textTitle: ORIGINAL_OWNER_CONTRACT_TEXT.title,
      textBody: ORIGINAL_OWNER_CONTRACT_TEXT.body,
      place: "Mendoza",
      dateLabel: "02/11/2026",
      startDate: "02/11/2026",
      startTime: "09:00",
      endDate: "02/11/2027",
      endTime: "09:00",
      ownerName: "Ana Pérez",
      ownerDocNumber: "30111222",
      ownerAddress: "San Martín 100",
      ownerEmail: null,
      ownerPhone: null,
      vehicleBrand: "Fiat",
      vehicleModel: "Cronos",
      vehicleYear: null,
      vehiclePlate: "AB123CD",
      insuranceCompany: null,
      insurancePolicyNumber: null,
      commercialTerms: null,
      km: 1000,
      fuelLevel: 8,
      fuelLevels: 8,
      condition: buildConditionSnapshot({}),
      observations: null,
      companySignerName: "Gastón",
      ownerSignerName: "Ana Pérez",
    }) as unknown as ReactElement<DocumentProps>;
    const pdf = await renderToBuffer(element);
    expect(pdf.subarray(0, 4).toString("latin1")).toBe("%PDF");
  }, 30000);
});
