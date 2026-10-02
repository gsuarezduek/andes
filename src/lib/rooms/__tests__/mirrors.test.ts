import { describe, expect, it } from "vitest";
import { findMirroredIds, type MirrorCandidate } from "../mirrors";

function make(overrides: Partial<MirrorCandidate> & Pick<MirrorCandidate, "id">): MirrorCandidate {
  return {
    roomId: "room-1",
    source: "airbnb",
    startDate: "2026-10-10",
    endDate: "2026-10-15",
    isBlock: false,
    status: "confirmed",
    externalLabel: null,
    createdAt: new Date("2026-10-01"),
    ...overrides,
  };
}

describe("findMirroredIds", () => {
  it("oculta el bloqueo de Airbnb cuando coincide exacto con una reserva de Booking", () => {
    const real = make({ id: "booking-real", source: "booking", startDate: "2026-10-10", endDate: "2026-10-15" });
    const block = make({
      id: "airbnb-block",
      source: "airbnb",
      isBlock: true,
      externalLabel: "Airbnb (Not available)",
      startDate: "2026-10-10",
      endDate: "2026-10-15",
    });
    expect(findMirroredIds([real, block])).toEqual(new Set(["airbnb-block"]));
  });

  it("oculta el bloqueo de Airbnb aunque el buffer de limpieza corra las fechas un día", () => {
    const real = make({ id: "booking-real", source: "booking", startDate: "2026-10-10", endDate: "2026-10-15" });
    const block = make({
      id: "airbnb-block",
      source: "airbnb",
      isBlock: true,
      externalLabel: "Airbnb (Not available)",
      startDate: "2026-10-09",
      endDate: "2026-10-16",
    });
    expect(findMirroredIds([real, block])).toEqual(new Set(["airbnb-block"]));
  });

  it("oculta el rótulo genérico 'CLOSED - Not available' de Booking cuando refleja una reserva real de Airbnb", () => {
    const real = make({ id: "airbnb-real", source: "airbnb", startDate: "2026-10-10", endDate: "2026-10-15" });
    const reflected = make({
      id: "booking-closed",
      source: "booking",
      isBlock: false,
      externalLabel: "CLOSED - Not available",
      startDate: "2026-10-11",
      endDate: "2026-10-15",
    });
    expect(findMirroredIds([real, reflected])).toEqual(new Set(["booking-closed"]));
  });

  it("NO oculta dos reservas reales que se solapan entre canales distintos (posible overbooking)", () => {
    const a = make({ id: "a", source: "airbnb", startDate: "2026-10-10", endDate: "2026-10-15" });
    const b = make({ id: "b", source: "booking", startDate: "2026-10-12", endDate: "2026-10-18" });
    expect(findMirroredIds([a, b])).toEqual(new Set());
  });

  it("NO oculta reservas que se solapan del mismo canal", () => {
    const a = make({ id: "a", source: "airbnb", isBlock: true, externalLabel: "Not available", startDate: "2026-10-10", endDate: "2026-10-15" });
    const b = make({ id: "b", source: "airbnb", startDate: "2026-10-12", endDate: "2026-10-18" });
    expect(findMirroredIds([a, b])).toEqual(new Set());
  });

  it("NO oculta reservas de distinto canal que no se solapan", () => {
    const a = make({ id: "a", source: "airbnb", isBlock: true, externalLabel: "Not available", startDate: "2026-10-10", endDate: "2026-10-15" });
    const b = make({ id: "b", source: "booking", startDate: "2026-10-20", endDate: "2026-10-25" });
    expect(findMirroredIds([a, b])).toEqual(new Set());
  });

  it("ignora las canceladas", () => {
    const real = make({ id: "booking-real", source: "booking", startDate: "2026-10-10", endDate: "2026-10-15" });
    const block = make({
      id: "airbnb-block",
      source: "airbnb",
      isBlock: true,
      status: "cancelled",
      externalLabel: "Airbnb (Not available)",
      startDate: "2026-10-10",
      endDate: "2026-10-15",
    });
    expect(findMirroredIds([real, block])).toEqual(new Set());
  });

  it("une transitivamente un grupo de 3 que se solapan en cadena", () => {
    const a = make({ id: "a", source: "booking", startDate: "2026-10-10", endDate: "2026-10-13" });
    const bridge = make({
      id: "bridge",
      source: "airbnb",
      isBlock: true,
      externalLabel: "Not available",
      startDate: "2026-10-12",
      endDate: "2026-10-16",
    });
    const c = make({
      id: "c",
      source: "other",
      isBlock: true,
      externalLabel: "Not available",
      startDate: "2026-10-15",
      endDate: "2026-10-18",
    });
    const hidden = findMirroredIds([a, bridge, c]);
    expect(hidden.has("bridge")).toBe(true);
    expect(hidden.has("c")).toBe(true);
    expect(hidden.has("a")).toBe(false);
  });
});
