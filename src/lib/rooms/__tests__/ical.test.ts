import { describe, expect, it } from "vitest";
import { parseIcal, isBlockEvent, addDaysToKey, diffDaysKeys, icalDateToKey } from "../ical";
import { findMirroredIds, type MirrorCandidate } from "../mirrors";

const AIRBNB = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Airbnb Inc//Hosting Calendar 1.0//EN
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260930
DTEND;VALUE=DATE:20261003
UID:abc123@airbnb.com
DESCRIPTION:Reservation URL: https://www.airbnb.com/hosting/reservations/de
 tails/HMXYZ\\nPhone Number (Last 4 Digits): 1234
SUMMARY:Reserved
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20261010
DTEND;VALUE=DATE:20261012
UID:blk1@airbnb.com
SUMMARY:Airbnb (Not available)
END:VEVENT
END:VCALENDAR`;

describe("parseIcal", () => {
  it("rechaza algo que no es un calendario", () => {
    expect(parseIcal("<html>login</html>").ok).toBe(false);
  });

  it("lee eventos de día completo, desplegando líneas plegadas", () => {
    const r = parseIcal(AIRBNB);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.events).toHaveLength(2);
    expect(r.events[0]).toMatchObject({
      uid: "abc123@airbnb.com",
      startDate: "2026-09-30",
      endDate: "2026-10-03",
      summary: "Reserved",
    });
    expect(r.events[0].description).toContain("HMXYZ");
    expect(r.events[0].description).toContain("Last 4 Digits): 1234");
  });

  it("acepta fechas con hora y CRLF", () => {
    const r = parseIcal(
      "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:x\r\nDTSTART:20260105T140000Z\r\nDTEND:20260108T100000Z\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n",
    );
    expect(r.ok && r.events[0]).toMatchObject({ startDate: "2026-01-05", endDate: "2026-01-08" });
  });

  it("sin DTEND, el evento sale al día siguiente", () => {
    const r = parseIcal("BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:x\nDTSTART;VALUE=DATE:20261231\nEND:VEVENT\nEND:VCALENDAR");
    expect(r.ok && r.events[0].endDate).toBe("2027-01-01");
  });

  it("sin UID genera uno estable", () => {
    const src = "BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART;VALUE=DATE:20260101\nDTEND;VALUE=DATE:20260103\nSUMMARY:Hola\nEND:VEVENT\nEND:VCALENDAR";
    const a = parseIcal(src);
    const b = parseIcal(src);
    expect(a.ok && b.ok && a.events[0].uid).toBe(b.ok && b.events[0].uid);
    expect(a.ok && a.events[0].uid.startsWith("nouid-")).toBe(true);
  });

  it("marca STATUS:CANCELLED", () => {
    const r = parseIcal("BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:x\nDTSTART;VALUE=DATE:20260101\nDTEND;VALUE=DATE:20260102\nSTATUS:CANCELLED\nEND:VEVENT\nEND:VCALENDAR");
    expect(r.ok && r.events[0].cancelled).toBe(true);
  });

  it("ignora fechas inválidas", () => {
    expect(icalDateToKey("20261345")).toBeNull();
    expect(icalDateToKey("basura")).toBeNull();
  });
});

describe("isBlockEvent", () => {
  it("Airbnb 'Not available' es bloqueo; 'Reserved' no", () => {
    expect(isBlockEvent("airbnb", "Airbnb (Not available)")).toBe(true);
    expect(isBlockEvent("airbnb", "Reserved")).toBe(false);
  });
  it("Booking nunca se asume bloqueo", () => {
    expect(isBlockEvent("booking", "CLOSED - Not available")).toBe(false);
  });
});

describe("fechas", () => {
  it("suma días cruzando mes y año", () => {
    expect(addDaysToKey("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDaysToKey("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("diferencia en días", () => {
    expect(diffDaysKeys("2026-09-30", "2026-10-03")).toBe(3);
  });
});

describe("findMirroredIds", () => {
  const base = (o: Partial<MirrorCandidate> & { id: string }): MirrorCandidate => ({
    roomId: "r1",
    source: "airbnb",
    startDate: "2026-10-01",
    endDate: "2026-10-04",
    isBlock: false,
    status: "confirmed",
    externalLabel: "Reserved",
    createdAt: new Date("2026-09-01"),
    ...o,
  });

  it("oculta el bloqueo de Airbnb que espeja una reserva de Booking", () => {
    const hidden = findMirroredIds([
      base({ id: "b", source: "booking", externalLabel: "Juan" }),
      base({ id: "a", source: "airbnb", isBlock: true, externalLabel: "Airbnb (Not available)" }),
    ]);
    expect([...hidden]).toEqual(["a"]);
  });

  it("entre 'Reserved' de Airbnb y 'CLOSED' de Booking, gana la de Airbnb", () => {
    const hidden = findMirroredIds([
      base({ id: "a", source: "airbnb", externalLabel: "Reserved" }),
      base({ id: "b", source: "booking", externalLabel: "CLOSED - Not available" }),
    ]);
    expect([...hidden]).toEqual(["b"]);
  });

  it("no oculta fechas distintas ni la misma procedencia (posible doble reserva real)", () => {
    expect(
      findMirroredIds([
        base({ id: "a" }),
        base({ id: "b", startDate: "2026-10-02" }),
        base({ id: "c", source: "airbnb" }),
      ]).size,
    ).toBe(0);
  });

  it("ignora las canceladas", () => {
    expect(
      findMirroredIds([base({ id: "a" }), base({ id: "b", source: "booking", status: "cancelled" })]).size,
    ).toBe(0);
  });
});
