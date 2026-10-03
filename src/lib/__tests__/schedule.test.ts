import { describe, expect, it } from "vitest";
import {
  weekStartOf,
  normalizeWeek,
  weekKeys,
  isSegmentActive,
  chipStatus,
  chipStatusMulti,
  isWeekendKey,
  rangeLabel,
  segmentRange,
  shortNames,
  spansFullDay,
  SHIFT_SEGMENTS,
  toMinutes,
} from "../schedule";

describe("semana", () => {
  it("el lunes de cualquier día de la semana", () => {
    expect(weekStartOf("2026-09-28")).toBe("2026-09-28"); // lunes
    expect(weekStartOf("2026-09-26")).toBe("2026-09-21"); // sábado
    expect(weekStartOf("2026-09-27")).toBe("2026-09-21"); // domingo cierra la semana
  });
  it("cruza mes y año", () => {
    expect(weekStartOf("2027-01-01")).toBe("2026-12-28");
    expect(weekKeys("2026-12-28")).toEqual([
      "2026-12-28", "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01", "2027-01-02", "2027-01-03",
    ]);
  });
  it("normaliza el parámetro de la URL", () => {
    expect(normalizeWeek("2026-09-24", "2026-01-01")).toBe("2026-09-21");
    expect(normalizeWeek("basura", "2026-09-26")).toBe("2026-09-21");
    expect(normalizeWeek(undefined, "2026-09-26")).toBe("2026-09-21");
  });
});

describe("turnos", () => {
  const morning = SHIFT_SEGMENTS.morning[0];
  const afternoon = SHIFT_SEGMENTS.afternoon[0];
  const at = (hm: string) => toMinutes(hm);

  it("mañana 9–16 y tarde 13–20 se pisan de 13 a 16", () => {
    expect(isSegmentActive(morning, at("08:59"))).toBe(false);
    expect(isSegmentActive(morning, at("09:00"))).toBe(true);
    expect(isSegmentActive(morning, at("15:59"))).toBe(true);
    expect(isSegmentActive(morning, at("16:00"))).toBe(false);
    expect(isSegmentActive(afternoon, at("13:00"))).toBe(true);
    expect(isSegmentActive(afternoon, at("20:00"))).toBe(false);
    // 14:00: los dos turnos están en curso
    expect(isSegmentActive(morning, at("14:00")) && isSegmentActive(afternoon, at("14:00"))).toBe(true);
  });

  it("el cortado tiene un corte en el medio", () => {
    const [a, b] = SHIFT_SEGMENTS.split;
    expect(isSegmentActive(a, at("10:00"))).toBe(true);
    expect(isSegmentActive(a, at("14:00")) || isSegmentActive(b, at("14:00"))).toBe(false);
    expect(isSegmentActive(b, at("17:00"))).toBe(true);
  });

  it("estado del chip: verde solo en curso ahora, azul en cualquier otro caso", () => {
    expect(chipStatus(morning, true, at("10:00"))).toBe("active");
    expect(chipStatus(morning, true, at("17:00"))).toBe("other");
    expect(chipStatus(morning, false, at("10:00"))).toBe("other");
    expect(chipStatus(SHIFT_SEGMENTS.on_call[0], false, at("03:00"))).toBe("other");
    expect(chipStatus(SHIFT_SEGMENTS.on_call[0], true, at("03:00"))).toBe("other");
  });

  it("la guardia cubre las dos filas (mañana y tarde), sin fila propia", () => {
    expect(SHIFT_SEGMENTS.on_call.map((seg) => seg.row)).toEqual(["morning", "afternoon"]);
    expect(SHIFT_SEGMENTS.on_call.every((seg) => seg.onCall)).toBe(true);
  });

  it("rangos legibles", () => {
    expect(segmentRange(morning)).toBe("9–16");
    expect(segmentRange({ row: "morning", start: "09:30", end: "13:00" })).toBe("9:30–13");
  });

  it("solo el cortado y la guardia ocupan las dos filas (se unifican en un solo chip)", () => {
    expect(spansFullDay("morning")).toBe(false);
    expect(spansFullDay("afternoon")).toBe(false);
    expect(spansFullDay("split")).toBe(true);
    expect(spansFullDay("on_call")).toBe(true);
  });

  it("rango combinado del turno unificado", () => {
    expect(rangeLabel(SHIFT_SEGMENTS.split)).toBe("9–13 y 16–20");
    expect(rangeLabel(SHIFT_SEGMENTS.on_call)).toBe(""); // guardia: disponibilidad, sin horario
    expect(rangeLabel(SHIFT_SEGMENTS.morning)).toBe("9–16");
  });

  it("estado del chip unificado: verde si cualquiera de los tramos está en curso", () => {
    expect(chipStatusMulti(SHIFT_SEGMENTS.split, true, at("10:00"))).toBe("active");
    expect(chipStatusMulti(SHIFT_SEGMENTS.split, true, at("14:30"))).toBe("other"); // en el corte
    expect(chipStatusMulti(SHIFT_SEGMENTS.split, true, at("17:00"))).toBe("active");
    expect(chipStatusMulti(SHIFT_SEGMENTS.split, false, at("10:00"))).toBe("other");
    expect(chipStatusMulti(SHIFT_SEGMENTS.on_call, true, at("03:00"))).toBe("other");
  });
});

describe("fin de semana", () => {
  it("sábado y domingo distintos de los días de semana", () => {
    expect(isWeekendKey("2026-09-26")).toBe(true); // sábado
    expect(isWeekendKey("2026-09-27")).toBe(true); // domingo
    expect(isWeekendKey("2026-09-28")).toBe(false); // lunes
    expect(isWeekendKey("2026-10-02")).toBe(false); // viernes
  });
});

describe("shortNames", () => {
  it("primer nombre, y con inicial del apellido si hay repetidos", () => {
    const m = shortNames([
      { id: "1", name: "Ana Pérez" },
      { id: "2", name: "Ana Gómez" },
      { id: "3", name: "Luis Díaz" },
    ]);
    expect(m.get("1")).toBe("Ana P.");
    expect(m.get("2")).toBe("Ana G.");
    expect(m.get("3")).toBe("Luis");
  });
});
