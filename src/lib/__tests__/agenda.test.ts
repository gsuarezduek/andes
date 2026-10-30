import { describe, expect, it } from "vitest";
import {
  agendaState,
  agendaTitle,
  isOfficeReturn,
  isValidTime,
  normalizeAgendaDay,
  nowMarkerIndex,
  sortAgenda,
  type AgendaItem,
} from "@/lib/agenda";

describe("isValidTime", () => {
  it("acepta HH:MM de 00:00 a 23:59", () => {
    expect(isValidTime("00:00")).toBe(true);
    expect(isValidTime("09:30")).toBe(true);
    expect(isValidTime("23:59")).toBe(true);
  });
  it("rechaza horas inválidas o mal formadas", () => {
    expect(isValidTime("24:00")).toBe(false);
    expect(isValidTime("9:30")).toBe(false);
    expect(isValidTime("12:60")).toBe(false);
    expect(isValidTime("")).toBe(false);
    expect(isValidTime(null)).toBe(false);
  });
});

describe("normalizeAgendaDay", () => {
  const today = "2026-10-30";
  it("sin parámetro, hoy", () => {
    expect(normalizeAgendaDay(undefined, today)).toBe(today);
  });
  it("respeta una fecha válida", () => {
    expect(normalizeAgendaDay("2026-11-02", today)).toBe("2026-11-02");
  });
  it("una fecha inválida vuelve a hoy", () => {
    expect(normalizeAgendaDay("2026-02-30", today)).toBe(today);
    expect(normalizeAgendaDay("mañana", today)).toBe(today);
  });
});

describe("agendaTitle", () => {
  const today = "2026-10-30";
  it("hoy, mañana y ayer por nombre", () => {
    expect(agendaTitle(today, today)).toBe("Agenda de hoy");
    expect(agendaTitle("2026-10-31", today)).toBe("Agenda de mañana");
    expect(agendaTitle("2026-10-29", today)).toBe("Agenda de ayer");
  });
  it("cualquier otro día con día de la semana y fecha", () => {
    expect(agendaTitle("2026-11-02", today)).toBe("Agenda del lunes 2 de noviembre");
  });
  it("mañana cruzando de mes", () => {
    expect(agendaTitle("2026-11-01", "2026-10-31")).toBe("Agenda de mañana");
  });
});

describe("isOfficeReturn", () => {
  it("solo la oficina va a la columna aparte", () => {
    expect(isOfficeReturn("Oficina Mendoza Ciudad")).toBe(true);
    expect(isOfficeReturn("Aeropuerto Mendoza Auto")).toBe(false);
    expect(isOfficeReturn("Hotel en Ciudad de Mendoza Auto")).toBe(false);
    expect(isOfficeReturn("Otro lugar")).toBe(false);
  });
  it("sin lugar cargado va a la agenda principal", () => {
    expect(isOfficeReturn(null)).toBe(false);
    expect(isOfficeReturn("  ")).toBe(false);
  });
});

describe("agendaState", () => {
  const at = new Date("2026-10-30T13:00:00Z");
  it("hecho siempre es completada", () => {
    expect(agendaState(true, at, new Date("2026-10-30T20:00:00Z"))).toBe("completada");
  });
  it("pendiente antes de la hora, demorada después", () => {
    expect(agendaState(false, at, new Date("2026-10-30T12:00:00Z"))).toBe("pendiente");
    expect(agendaState(false, at, new Date("2026-10-30T14:00:00Z"))).toBe("demorada");
  });
});

function task(time: string, key = time): AgendaItem {
  return {
    kind: "task",
    key,
    time,
    taskId: key,
    text: "x",
    highPriority: false,
    assignedToName: null,
    vehicleId: null,
    vehicleLabel: null,
    rentalId: null,
    rentalClientName: null,
    completedByName: null,
    state: "pendiente",
  };
}

function handover(time: string, key = `h-${time}`): AgendaItem {
  return {
    kind: "handover",
    key,
    time,
    rentalId: key,
    clientName: "Cliente",
    vehicleLabel: null,
    place: null,
    state: "pendiente",
    unconfirmed: false,
    accent: null,
  };
}

describe("sortAgenda", () => {
  it("ordena por hora", () => {
    const sorted = sortAgenda([task("15:00"), task("09:00"), task("11:30")]);
    expect(sorted.map((i) => i.time)).toEqual(["09:00", "11:30", "15:00"]);
  });
  it("a la misma hora, una entrega va antes que una tarea", () => {
    const sorted = sortAgenda([task("10:00", "t"), handover("10:00", "h")]);
    expect(sorted.map((i) => i.key)).toEqual(["h", "t"]);
  });
});

describe("nowMarkerIndex", () => {
  const items = [task("09:00"), task("12:00"), task("18:00")];
  it("antes del primer ítem que todavía no llegó", () => {
    expect(nowMarkerIndex(items, "10:15")).toBe(1);
  });
  it("antes de todo si es temprano", () => {
    expect(nowMarkerIndex(items, "07:00")).toBe(0);
  });
  it("al final si ya pasaron todos", () => {
    expect(nowMarkerIndex(items, "20:00")).toBe(3);
  });
  it("un ítem justo a la hora actual queda antes de la línea", () => {
    expect(nowMarkerIndex(items, "12:00")).toBe(2);
  });
});
