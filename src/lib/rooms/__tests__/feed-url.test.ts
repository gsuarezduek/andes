import { describe, expect, it } from "vitest";
import { validateFeedUrl } from "../feed-url";
import { isDateKey, nightsBetween, rangesOverlap } from "../dates";

describe("validateFeedUrl", () => {
  it("acepta https y convierte webcal", () => {
    expect(validateFeedUrl("https://www.airbnb.com/calendar/ical/1.ics?s=x").ok).toBe(true);
    const r = validateFeedUrl("webcal://ical.booking.com/v1/export?t=abc");
    expect(r.ok && r.url.startsWith("https://")).toBe(true);
  });
  it("rechaza http, basura y hosts internos", () => {
    expect(validateFeedUrl("http://x.com/a.ics").ok).toBe(false);
    expect(validateFeedUrl("no es url").ok).toBe(false);
    expect(validateFeedUrl("https://localhost/a.ics").ok).toBe(false);
    expect(validateFeedUrl("https://192.168.1.10/a.ics").ok).toBe(false);
    expect(validateFeedUrl("https://172.20.0.1/a.ics").ok).toBe(false);
    expect(validateFeedUrl("https://169.254.169.254/latest").ok).toBe(false);
  });
});

describe("dates", () => {
  it("valida claves de fecha", () => {
    expect(isDateKey("2026-09-30")).toBe(true);
    expect(isDateKey("2026-02-30")).toBe(false);
    expect(isDateKey("30/09/2026")).toBe(false);
  });
  it("noches y solapamiento (salida = entrada no pisa)", () => {
    expect(nightsBetween("2026-09-30", "2026-10-03")).toBe(3);
    expect(rangesOverlap("2026-10-01", "2026-10-04", "2026-10-04", "2026-10-06")).toBe(false);
    expect(rangesOverlap("2026-10-01", "2026-10-04", "2026-10-03", "2026-10-06")).toBe(true);
  });
});
