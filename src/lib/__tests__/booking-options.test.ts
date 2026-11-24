import { describe, expect, it } from "vitest";
import { rankNames } from "@/lib/booking-options";
import { isManualThirdPartyRental } from "@/lib/rental-flags";

describe("rankNames", () => {
  it("suma retiros y devoluciones del mismo lugar y ordena por uso", () => {
    expect(
      rankNames([
        { name: "Oficina Mendoza Ciudad", count: 3 },
        { name: "Aeropuerto Mendoza Auto", count: 5 },
        { name: "Oficina Mendoza Ciudad ", count: 4 },
      ]),
    ).toEqual(["Oficina Mendoza Ciudad", "Aeropuerto Mendoza Auto"]);
  });

  it("descarta vacíos y desempata alfabéticamente", () => {
    expect(
      rankNames([
        { name: null, count: 9 },
        { name: "  ", count: 9 },
        { name: "Hotel", count: 1 },
        { name: "Aeropuerto", count: 1 },
      ]),
    ).toEqual(["Aeropuerto", "Hotel"]);
  });
});

describe("isManualThirdPartyRental", () => {
  it("solo un alquiler manual de un auto de tercero", () => {
    expect(isManualThirdPartyRental({ origin: "manual", vehicle: { ownership: "third_party" } })).toBe(true);
    expect(isManualThirdPartyRental({ origin: "vikrentcar", vehicle: { ownership: "third_party" } })).toBe(false);
    expect(isManualThirdPartyRental({ origin: "manual", vehicle: { ownership: "own" } })).toBe(false);
    expect(isManualThirdPartyRental({ origin: "manual", vehicle: null })).toBe(false);
  });
});
