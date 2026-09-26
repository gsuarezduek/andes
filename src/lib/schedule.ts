import { addDaysToKey } from "@/lib/rooms/ical";
import { isDateKey } from "@/lib/rooms/dates";

/**
 * Horarios del equipo: lógica pura (sin base de datos, testeable). Un turno es
 * de un día completo por persona; la semana va de lunes a domingo.
 */

export const SHIFTS = ["morning", "afternoon", "split", "on_call"] as const;
export type Shift = (typeof SHIFTS)[number];

export const shiftLabels: Record<Shift, string> = {
  morning: "Mañana",
  afternoon: "Tarde",
  split: "Cortado",
  on_call: "Guardia",
};

/** Filas de la grilla semanal: mañana y tarde (la guardia va dentro de ambas, en azul). */
export type ScheduleRow = "morning" | "afternoon";
export const SCHEDULE_ROWS: ScheduleRow[] = ["morning", "afternoon"];

export const rowLabels: Record<ScheduleRow, string> = {
  morning: "Mañana",
  afternoon: "Tarde",
};

/**
 * Un tramo horario ("HH:MM", hora de Mendoza) que un turno cubre en una fila.
 * `onCall` marca la guardia: disponibilidad, no presencia (sin activo/inactivo).
 */
export type Segment = { row: ScheduleRow; start: string; end: string; onCall?: true };

/**
 * Horarios de cada turno. Mañana 9 a 16 y tarde 13 a 20 (se pisan de 13 a 16).
 * El cortado es parte de cada turno con un corte en el medio: **supuesto** 9 a
 * 13 y 16 a 20 — se ajusta acá si el corte real es otro. La guardia es
 * disponibilidad, no presencia: no tiene "activo/inactivo" y se muestra en
 * las dos filas (mañana y tarde) para no ocupar una fila aparte.
 */
export const SHIFT_SEGMENTS: Record<Shift, Segment[]> = {
  morning: [{ row: "morning", start: "09:00", end: "16:00" }],
  afternoon: [{ row: "afternoon", start: "13:00", end: "20:00" }],
  split: [
    { row: "morning", start: "09:00", end: "13:00" },
    { row: "afternoon", start: "16:00", end: "20:00" },
  ],
  on_call: [
    { row: "morning", start: "00:00", end: "24:00", onCall: true },
    { row: "afternoon", start: "00:00", end: "24:00", onCall: true },
  ],
};

export const WEEKDAY_LABELS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"] as const;

/** Lunes de la semana de una fecha "YYYY-MM-DD" (la semana argentina arranca el lunes). */
export function weekStartOf(dateKey: string): string {
  const dow = new Date(`${dateKey}T00:00:00Z`).getUTCDay(); // 0 = domingo
  return addDaysToKey(dateKey, -((dow + 6) % 7));
}

/** Parámetro `?week=` de la URL → lunes válido; cualquier otra cosa cae a la semana de `todayKey`. */
export function normalizeWeek(raw: string | undefined, todayKey: string): string {
  return isDateKey(raw) ? weekStartOf(raw) : weekStartOf(todayKey);
}

/** Los 7 días ("YYYY-MM-DD") de la semana que arranca en `weekStart`. */
export function weekKeys(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDaysToKey(weekStart, i));
}

/** "HH:MM" → minutos desde medianoche. */
export function toMinutes(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

/** ¿El tramo está en curso a esa hora (`nowMin`, minutos de Mendoza)? Inicio incluido, fin excluido. */
export function isSegmentActive(seg: Segment, nowMin: number): boolean {
  return toMinutes(seg.start) <= nowMin && nowMin < toMinutes(seg.end);
}

/**
 * Estado con el que se pinta a una persona en un tramo (verde/rojo/azul como
 * en el Excel que usaban): `onCall` = guardia (azul); hoy → `active` (verde,
 * en curso ahora) o `inactive` (rojo, todavía no empezó o ya terminó); otro
 * día → `scheduled` (neutro: no tiene sentido decir activo/inactivo).
 */
export type ChipStatus = "active" | "inactive" | "on_call" | "scheduled";

export function chipStatus(seg: Segment, isToday: boolean, nowMin: number): ChipStatus {
  if (seg.onCall) return "on_call";
  if (!isToday) return "scheduled";
  return isSegmentActive(seg, nowMin) ? "active" : "inactive";
}

/** "09:00" → "9", "16:30" → "16:30" (para chips compactos). */
export function shortHour(hm: string): string {
  const [h, m] = hm.split(":");
  return m === "00" ? String(Number(h)) : `${Number(h)}:${m}`;
}

export function segmentRange(seg: Segment): string {
  return `${shortHour(seg.start)}–${shortHour(seg.end)}`;
}

/** Nombre corto para el chip: el primero; si hay dos iguales, suma la inicial del apellido. */
export function shortNames(people: { id: string; name: string }[]): Map<string, string> {
  const first = (n: string) => n.trim().split(/\s+/)[0] ?? n;
  const counts = new Map<string, number>();
  for (const p of people) counts.set(first(p.name).toLowerCase(), (counts.get(first(p.name).toLowerCase()) ?? 0) + 1);
  const out = new Map<string, string>();
  for (const p of people) {
    const parts = p.name.trim().split(/\s+/);
    const dup = (counts.get(first(p.name).toLowerCase()) ?? 0) > 1;
    out.set(p.id, dup && parts[1] ? `${parts[0]} ${parts[1][0]}.` : parts[0] ?? p.name);
  }
  return out;
}
