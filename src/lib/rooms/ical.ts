/**
 * Parser mínimo de iCalendar (RFC 5545) para los feeds de disponibilidad de
 * Airbnb / Booking. Solo lee VEVENT con UID/DTSTART/DTEND/SUMMARY/DESCRIPTION/
 * STATUS — no necesita nada más. Puro y sin dependencias (testeable).
 */

export type IcalEvent = {
  uid: string;
  /** "YYYY-MM-DD" — primer día (entrada). */
  startDate: string;
  /** "YYYY-MM-DD" — día de salida (exclusivo, la noche de ese día no se ocupa). */
  endDate: string;
  summary: string | null;
  description: string | null;
  cancelled: boolean;
};

export type IcalParseResult = { ok: true; events: IcalEvent[] } | { ok: false; error: string };

/** Une las líneas plegadas (las que siguen empiezan con espacio o tab). */
function unfold(raw: string): string[] {
  const lines = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && out.length > 0) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }
  return out;
}

function unescapeText(v: string): string {
  return v.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\;/g, ";").replace(/\\\\/g, "\\");
}

/** "NAME;PARAM=x:value" → { name, params, value }. */
function splitLine(line: string): { name: string; params: string; value: string } | null {
  const colon = line.indexOf(":");
  if (colon < 0) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const semi = head.indexOf(";");
  const name = (semi < 0 ? head : head.slice(0, semi)).toUpperCase();
  const params = semi < 0 ? "" : head.slice(semi + 1).toUpperCase();
  return { name, params, value };
}

/**
 * Fecha de un DTSTART/DTEND → "YYYY-MM-DD". Los feeds de alquiler son de día
 * completo (`VALUE=DATE:20260930`); si viniera con hora ("20260930T140000Z")
 * se toma solo la parte de la fecha, tal cual está escrita (sin convertir de
 * zona horaria: para estos feeds lo que importa es el día de calendario).
 */
export function icalDateToKey(value: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d] = m;
  const month = Number(mo);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${y}-${mo}-${d}`;
}

/** Suma `n` días a un "YYYY-MM-DD" (aritmética de calendario, sin zona horaria). */
export function addDaysToKey(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

/** Días entre dos "YYYY-MM-DD" (b − a). */
export function diffDaysKeys(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000);
}

/** Hash simple y estable (djb2) para armar un UID cuando el evento no trae uno. */
function fallbackUid(start: string, end: string, summary: string | null): string {
  const str = `${start}|${end}|${summary ?? ""}`;
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return `nouid-${start}-${end}-${(h >>> 0).toString(36)}`;
}

export function parseIcal(raw: string): IcalParseResult {
  if (!/BEGIN:VCALENDAR/i.test(raw)) {
    return { ok: false, error: "La respuesta no es un calendario iCal válido." };
  }
  const lines = unfold(raw);
  const events: IcalEvent[] = [];
  let cur: {
    uid?: string;
    start?: string | null;
    end?: string | null;
    summary?: string;
    description?: string;
    status?: string;
  } | null = null;

  for (const line of lines) {
    const upper = line.trim().toUpperCase();
    if (upper === "BEGIN:VEVENT") {
      cur = {};
      continue;
    }
    if (upper === "END:VEVENT") {
      if (cur && cur.start) {
        // Sin DTEND (evento de un solo día): sale al día siguiente.
        const end = cur.end && cur.end > cur.start ? cur.end : addDaysToKey(cur.start, 1);
        const summary = cur.summary?.trim() || null;
        events.push({
          uid: cur.uid?.trim() || fallbackUid(cur.start, end, summary),
          startDate: cur.start,
          endDate: end,
          summary,
          description: cur.description?.trim() || null,
          cancelled: cur.status === "CANCELLED",
        });
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const parsed = splitLine(line);
    if (!parsed) continue;
    switch (parsed.name) {
      case "UID":
        cur.uid = parsed.value;
        break;
      case "DTSTART":
        cur.start = icalDateToKey(parsed.value);
        break;
      case "DTEND":
        cur.end = icalDateToKey(parsed.value);
        break;
      case "SUMMARY":
        cur.summary = unescapeText(parsed.value);
        break;
      case "DESCRIPTION":
        cur.description = unescapeText(parsed.value);
        break;
      case "STATUS":
        cur.status = parsed.value.trim().toUpperCase();
        break;
    }
  }
  return { ok: true, events };
}

/**
 * ¿Este evento es un bloqueo de disponibilidad y no una reserva de un huésped?
 * Airbnb marca los bloqueos manuales como "Airbnb (Not available)" y las
 * reservas como "Reserved". Booking no distingue ("CLOSED - Not available"
 * puede ser una reserva real), así que ahí nunca se asume bloqueo.
 */
export function isBlockEvent(source: "airbnb" | "booking" | "other", summary: string | null): boolean {
  if (source !== "airbnb") return false;
  return /not available/i.test(summary ?? "") && !/reserved/i.test(summary ?? "");
}
