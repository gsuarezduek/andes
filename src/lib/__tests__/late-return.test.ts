import { describe, it, expect } from "vitest";
import {
  MAX_LATE_EXTRA_HOURS,
  isLateReturn,
  lateReturnBreakdown,
  lateReturnCharge,
  lateReturnDetail,
} from "@/lib/late-return";

const END = new Date("2026-03-10T10:00:00.000Z");
/** Devolución real `h` horas (y `m` minutos) después de lo pactado. */
const late = (h: number, m = 0) => new Date(END.getTime() + h * 3_600_000 + m * 60_000);

describe("lateReturnBreakdown", () => {
  it("no hay atraso si volvió en hora o antes", () => {
    expect(lateReturnBreakdown(END, END)).toEqual({ days: 0, hours: 0 });
    expect(lateReturnBreakdown(END, late(-3))).toEqual({ days: 0, hours: 0 });
  });

  it("un resto de segundos no es una hora de cargo", () => {
    expect(lateReturnBreakdown(END, new Date(END.getTime() + 20_000))).toEqual({ days: 0, hours: 0 });
  });

  it("sin tolerancia: el primer minuto ya cobra la hora empezada", () => {
    expect(lateReturnBreakdown(END, late(0, 1))).toEqual({ days: 0, hours: 1 });
    expect(lateReturnBreakdown(END, late(0, 40))).toEqual({ days: 0, hours: 1 });
  });

  it("cobra las horas del atraso, redondeando la hora empezada hacia arriba", () => {
    expect(lateReturnBreakdown(END, late(2))).toEqual({ days: 0, hours: 2 });
    expect(lateReturnBreakdown(END, late(2, 10))).toEqual({ days: 0, hours: 3 });
    expect(lateReturnBreakdown(END, late(4))).toEqual({ days: 0, hours: MAX_LATE_EXTRA_HOURS });
  });

  it("a partir de 5 horas cobra el día entero y ninguna hora", () => {
    // 5 horas al 20% ya son el 100% del día: cobrar 5 horas nunca tiene sentido.
    expect(lateReturnBreakdown(END, late(5))).toEqual({ days: 1, hours: 0 });
    expect(lateReturnBreakdown(END, late(4, 10))).toEqual({ days: 1, hours: 0 });
    expect(lateReturnBreakdown(END, late(23))).toEqual({ days: 1, hours: 0 });
  });

  it("parte el atraso largo en días completos + el resto de horas", () => {
    expect(lateReturnBreakdown(END, late(24))).toEqual({ days: 1, hours: 0 });
    expect(lateReturnBreakdown(END, late(26))).toEqual({ days: 1, hours: 2 });
    expect(lateReturnBreakdown(END, late(29))).toEqual({ days: 2, hours: 0 });
    expect(lateReturnBreakdown(END, late(50))).toEqual({ days: 2, hours: 2 });
  });

  it("el resto nunca llega a 5 horas", () => {
    for (let m = 1; m <= 60 * 48; m += 7) {
      expect(lateReturnBreakdown(END, late(0, m)).hours).toBeLessThanOrEqual(MAX_LATE_EXTRA_HOURS);
    }
  });
});

describe("lateReturnCharge", () => {
  const pricing = { dailyRate: 50_000, extraHourPercent: 20 };

  it("cobra la tarifa diaria por día y el % pactado por hora", () => {
    expect(lateReturnCharge(pricing, { days: 0, hours: 2 })).toBe(20_000); // 2 × 20%
    expect(lateReturnCharge(pricing, { days: 1, hours: 0 })).toBe(50_000);
    expect(lateReturnCharge(pricing, { days: 1, hours: 2 })).toBe(70_000);
  });

  it("sin atraso no cobra nada", () => {
    expect(lateReturnCharge(pricing, { days: 0, hours: 0 })).toBe(0);
  });

  it("sin tarifa diaria no sugiere importe (lo carga el empleado)", () => {
    expect(lateReturnCharge({ extraHourPercent: 20 }, { days: 1, hours: 2 })).toBeNull();
    expect(lateReturnCharge(null, { days: 1, hours: 0 })).toBeNull();
  });

  it("sin hora extra configurada, el resto de horas se cobra como un día más", () => {
    // Mismo criterio que `estimateQuoteTotal` sin `extraHourPercent`: el resto
    // redondea a día completo, no se regala.
    expect(lateReturnCharge({ dailyRate: 50_000 }, { days: 0, hours: 2 })).toBe(50_000);
    expect(lateReturnCharge({ dailyRate: 50_000 }, { days: 1, hours: 2 })).toBe(100_000);
    expect(lateReturnCharge({ dailyRate: 50_000 }, { days: 2, hours: 0 })).toBe(100_000);
  });
});

describe("isLateReturn / lateReturnDetail", () => {
  it("resume el atraso sin palabras, para no pluralizar en dos idiomas", () => {
    expect(lateReturnDetail({ days: 0, hours: 0 })).toBe("");
    expect(lateReturnDetail({ days: 0, hours: 3 })).toBe("3 h");
    expect(lateReturnDetail({ days: 1, hours: 0 })).toBe("1 d");
    expect(lateReturnDetail({ days: 2, hours: 4 })).toBe("2 d 4 h");
  });

  it("distingue atraso de devolución en hora", () => {
    expect(isLateReturn({ days: 0, hours: 0 })).toBe(false);
    expect(isLateReturn({ days: 0, hours: 1 })).toBe(true);
    expect(isLateReturn({ days: 1, hours: 0 })).toBe(true);
  });
});
