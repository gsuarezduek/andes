import { describe, it, expect } from "vitest";
import {
  average,
  computeOccupancy,
  computeResponseWaits,
  formatDuration,
  leadTimeDays,
  median,
  overlapDays,
  settlementExtras,
  summarizeLeadTimes,
  summarizeResponseTimes,
  type ResponseMessage,
} from "@/lib/reports-metrics";

const d = (iso: string) => new Date(iso);

describe("median / average", () => {
  it("mediana de cantidad impar y par", () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([1, 2, 3, 10])).toBe(2.5);
  });
  it("listas vacías → null", () => {
    expect(median([])).toBeNull();
    expect(average([])).toBeNull();
  });
  it("promedio", () => {
    expect(average([1, 2, 6])).toBe(3);
  });
});

describe("overlapDays", () => {
  it("recorta al período", () => {
    expect(overlapDays(d("2026-08-30T00:00Z"), d("2026-09-03T00:00Z"), d("2026-09-01T00:00Z"), d("2026-10-01T00:00Z"))).toBe(2);
  });
  it("sin superposición → 0", () => {
    expect(overlapDays(d("2026-07-01T00:00Z"), d("2026-07-05T00:00Z"), d("2026-09-01T00:00Z"), d("2026-10-01T00:00Z"))).toBe(0);
  });
});

describe("computeOccupancy", () => {
  const pStart = d("2026-09-01T00:00Z");
  const pEnd = d("2026-09-11T00:00Z"); // 10 días

  it("días alquilados sobre flota × días del período", () => {
    const { summary, byVehicle } = computeOccupancy(
      [
        { vehicleId: "a", start: d("2026-09-01T00:00Z"), end: d("2026-09-06T00:00Z") }, // 5 días
        { vehicleId: "b", start: d("2026-09-09T00:00Z"), end: d("2026-09-20T00:00Z") }, // 2 días dentro del período
      ],
      ["a", "b"],
      pStart,
      pEnd,
    );
    expect(summary).toEqual({ percent: 35, rentedDays: 7, availableDays: 20, fleetUnits: 2 });
    expect(byVehicle.get("a")).toBe(50);
    expect(byVehicle.get("b")).toBe(20);
  });

  it("un alquiler abierto se corta en la siguiente entrega del mismo auto (se devolvió sin registrarlo)", () => {
    const { byVehicle } = computeOccupancy(
      [
        // Activo desde el 1, nunca cerrado en Andes...
        { vehicleId: "a", start: d("2026-09-01T00:00Z"), end: d("2026-09-11T00:00Z"), open: true },
        // ...pero el 5 el auto se entregó de nuevo y volvió el 7.
        { vehicleId: "a", start: d("2026-09-05T00:00Z"), end: d("2026-09-07T00:00Z") },
      ],
      ["a"],
      pStart,
      pEnd,
    );
    // 1→5 (abierto cortado) + 5→7 = 6 días de 10, no el 100%.
    expect(byVehicle.get("a")).toBe(60);
  });

  it("un alquiler abierto sin entregas posteriores sigue hasta hoy", () => {
    const { byVehicle } = computeOccupancy(
      [{ vehicleId: "a", start: d("2026-09-04T00:00Z"), end: d("2026-09-11T00:00Z"), open: true }],
      ["a"],
      pStart,
      pEnd,
    );
    expect(byVehicle.get("a")).toBe(70);
  });

  it("dos alquileres superpuestos del mismo auto no cuentan dos veces el mismo día", () => {
    const { byVehicle } = computeOccupancy(
      [
        { vehicleId: "a", start: d("2026-09-01T00:00Z"), end: d("2026-09-06T00:00Z") },
        { vehicleId: "a", start: d("2026-09-04T00:00Z"), end: d("2026-09-08T00:00Z") },
      ],
      ["a"],
      pStart,
      pEnd,
    );
    expect(byVehicle.get("a")).toBe(70);
  });

  it("dos alquileres superpuestos del mismo auto no pasan del 100%", () => {
    const { byVehicle } = computeOccupancy(
      [
        { vehicleId: "a", start: d("2026-09-01T00:00Z"), end: d("2026-09-11T00:00Z") },
        { vehicleId: "a", start: d("2026-09-02T00:00Z"), end: d("2026-09-08T00:00Z") },
      ],
      ["a"],
      pStart,
      pEnd,
    );
    expect(byVehicle.get("a")).toBe(100);
  });

  it("un auto archivado no suma al total de la flota pero sí tiene su propio %", () => {
    const { summary, byVehicle } = computeOccupancy(
      [{ vehicleId: "old", start: d("2026-09-01T00:00Z"), end: d("2026-09-06T00:00Z") }],
      ["a"],
      pStart,
      pEnd,
    );
    expect(summary.percent).toBe(0);
    expect(summary.rentedDays).toBe(0);
    expect(byVehicle.get("old")).toBe(50);
  });

  it("sin flota → null", () => {
    expect(computeOccupancy([], [], pStart, pEnd).summary.percent).toBeNull();
  });
});

describe("settlementExtras", () => {
  it("suma km extra, nafta y daños", () => {
    expect(settlementExtras({ extraKmCharge: 1000, fuelCharge: 500, damagesTotal: 2000 })).toEqual({
      km: 1000,
      fuel: 500,
      damages: 2000,
      total: 3500,
    });
  });
  it("tolera liquidación ausente o incompleta", () => {
    expect(settlementExtras(null).total).toBe(0);
    expect(settlementExtras({ extraKmCharge: "x" }).total).toBe(0);
  });
});

describe("anticipación de reservas", () => {
  it("días entre la carga y el retiro, nunca negativos", () => {
    expect(leadTimeDays(d("2026-09-10T00:00Z"), d("2026-09-03T00:00Z"))).toBe(7);
    expect(leadTimeDays(d("2026-09-10T00:00Z"), d("2026-09-12T00:00Z"))).toBe(0);
  });

  it("resume promedio, mediana y reparte en tramos", () => {
    const s = summarizeLeadTimes([0, 2, 5, 10, 45]);
    expect(s.withData).toBe(5);
    expect(s.medianDays).toBe(5);
    expect(s.averageDays).toBe(12.4);
    expect(s.buckets.map((b) => b.count)).toEqual([1, 1, 1, 1, 1]);
  });

  it("sin datos → null y tramos en cero", () => {
    const s = summarizeLeadTimes([]);
    expect(s.averageDays).toBeNull();
    expect(s.buckets.every((b) => b.count === 0)).toBe(true);
  });
});

describe("tiempo de respuesta de WhatsApp", () => {
  const pStart = d("2026-09-01T00:00Z");
  const pEnd = d("2026-10-01T00:00Z");
  const msg = (c: string, direction: "in" | "out", iso: string, sentByBot = false): ResponseMessage => ({
    conversationId: c,
    direction,
    createdAt: d(iso),
    sentByBot,
  });

  it("mide del mensaje del cliente al siguiente saliente; varios entrantes seguidos son una espera", () => {
    const { waits, unanswered } = computeResponseWaits(
      [
        msg("a", "in", "2026-09-05T10:00Z"),
        msg("a", "in", "2026-09-05T10:05Z"), // misma espera, cuenta desde las 10:00
        msg("a", "out", "2026-09-05T10:30Z"),
        msg("a", "in", "2026-09-05T11:00Z"), // nueva espera
        msg("a", "out", "2026-09-05T11:02Z", true), // la contesta el bot
      ],
      pStart,
      pEnd,
    );
    expect(waits).toEqual([
      { minutes: 30, byBot: false },
      { minutes: 2, byBot: true },
    ]);
    expect(unanswered).toBe(0);
  });

  it("cuenta las esperas sin respuesta y las que empezaron fuera del período no entran", () => {
    const { waits, unanswered } = computeResponseWaits(
      [
        msg("a", "in", "2026-08-31T23:00Z"), // empezó antes del período
        msg("a", "out", "2026-09-01T01:00Z"),
        msg("b", "in", "2026-09-20T10:00Z"), // sin respuesta
      ],
      pStart,
      pEnd,
    );
    expect(waits).toEqual([]);
    expect(unanswered).toBe(1);
  });

  it("acepta mensajes desordenados y de varias conversaciones", () => {
    const { waits } = computeResponseWaits(
      [msg("a", "out", "2026-09-05T10:10Z"), msg("b", "in", "2026-09-05T09:00Z"), msg("a", "in", "2026-09-05T10:00Z"), msg("b", "out", "2026-09-05T11:00Z")],
      pStart,
      pEnd,
    );
    expect(waits.map((w) => w.minutes).sort((x, y) => x - y)).toEqual([10, 120]);
  });

  it("resume mediana general y humana por separado", () => {
    const s = summarizeResponseTimes(
      [
        { minutes: 1, byBot: true },
        { minutes: 2, byBot: true },
        { minutes: 60, byBot: false },
        { minutes: 120, byBot: false },
      ],
      3,
    );
    expect(s.medianMinutes).toBe(31);
    expect(s.humanMedianMinutes).toBe(90);
    expect(s.humanWaits).toBe(2);
    expect(s.unanswered).toBe(3);
  });

  it("sin esperas → null", () => {
    const s = summarizeResponseTimes([], 0);
    expect(s.medianMinutes).toBeNull();
    expect(s.humanMedianMinutes).toBeNull();
  });
});

describe("formatDuration", () => {
  it("formatea minutos, horas y días", () => {
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(0.3)).toBe("menos de 1 min");
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(130)).toBe("2 h 10 min");
    expect(formatDuration(120)).toBe("2 h");
    expect(formatDuration(59.7)).toBe("1 h");
    expect(formatDuration(60 * 36)).toBe("1,5 d");
  });
});
