/**
 * Agenda del día (Home): lógica pura, sin base de datos — ver
 * `agenda-queries.ts` para la lectura. La agenda mezcla, ordenado por hora,
 * todo lo que pasa un día puntual: entregas, devoluciones, tareas con agenda
 * (`Task.scheduledTime`) y check-in de habitaciones. Lo que NO obliga a nadie a
 * salir (devoluciones en la oficina y check-out de habitaciones) va aparte, a
 * la columna angosta.
 */
import { addDaysToKey } from "@/lib/rooms/ical";
import { formatSpecialDateLabel } from "@/lib/special-dates";
import { placeCode, type PlaceCode } from "@/lib/place-code";
import type { PaymentAccent } from "@/lib/rental-payments";

export type AgendaState = "pendiente" | "completada" | "demorada";

type AgendaBase = {
  /** Clave única en la lista (puede repetirse un mismo alquiler: entrega y devolución el mismo día). */
  key: string;
  /** "HH:MM", hora Mendoza. */
  time: string;
};

export type AgendaRentalItem = AgendaBase & {
  kind: "handover" | "return";
  rentalId: string;
  clientName: string;
  vehicleLabel: string | null;
  place: PlaceCode | null;
  state: AgendaState;
  unconfirmed: boolean;
  accent: PaymentAccent;
};

export type AgendaTaskItem = AgendaBase & {
  kind: "task";
  taskId: string;
  text: string;
  highPriority: boolean;
  assignedToName: string | null;
  vehicleId: string | null;
  vehicleLabel: string | null;
  rentalId: string | null;
  rentalClientName: string | null;
  completedByName: string | null;
  state: AgendaState;
};

export type AgendaRoomItem = AgendaBase & {
  kind: "checkin" | "checkout";
  roomId: string;
  bookingId: string;
  roomName: string;
  guest: string;
  sourceLabel: string;
};

export type AgendaItem = AgendaRentalItem | AgendaTaskItem | AgendaRoomItem;

/** "HH:MM" de 00:00 a 23:59. */
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTime(v: unknown): v is string {
  return typeof v === "string" && TIME_PATTERN.test(v);
}

/** `?day=` de la URL → "YYYY-MM-DD" válido; cualquier otra cosa vuelve a hoy. */
export function normalizeAgendaDay(raw: string | undefined, todayKey: string): string {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return todayKey;
  const d = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== raw) return todayKey;
  return raw;
}

/** "Agenda de hoy" / "de mañana" / "de ayer"; cualquier otro día, "Agenda del lunes 12 de octubre". */
export function agendaTitle(dayKey: string, todayKey: string): string {
  if (dayKey === todayKey) return "Agenda de hoy";
  if (dayKey === addDaysToKey(todayKey, 1)) return "Agenda de mañana";
  if (dayKey === addDaysToKey(todayKey, -1)) return "Agenda de ayer";
  const label = formatSpecialDateLabel(dayKey);
  return `Agenda del ${label.charAt(0).toLowerCase()}${label.slice(1)}`;
}

/**
 * ¿Esta devolución va a la columna "en oficina"? Solo si VikRentCar (o un
 * empleado) dijo explícitamente que es en la oficina. Sin lugar cargado
 * (reserva manual, sync sin el dato) va a la agenda principal: es más seguro
 * que alguien la vea con horario a que quede escondida como "de oficina".
 */
export function isOfficeReturn(returnPlace: string | null | undefined): boolean {
  return placeCode(returnPlace) === "OFI";
}

/** Estado de algo agendado: hecho, o pendiente/demorado según si ya pasó la hora. */
export function agendaState(done: boolean, at: Date, now: Date): AgendaState {
  if (done) return "completada";
  return now > at ? "demorada" : "pendiente";
}

/** Orden al empatar la hora: primero lo que es con un cliente, después las tareas internas. */
const KIND_ORDER: Record<AgendaItem["kind"], number> = {
  handover: 0,
  return: 1,
  checkin: 2,
  checkout: 3,
  task: 4,
};

export function sortAgenda<T extends AgendaItem>(items: T[]): T[] {
  return [...items].sort((a, b) =>
    a.time !== b.time ? a.time.localeCompare(b.time) : KIND_ORDER[a.kind] - KIND_ORDER[b.kind],
  );
}

/**
 * Dónde va la línea de "ahora": antes del primer ítem que todavía no llegó
 * (hora estrictamente posterior a `nowTime`). Si ya pasaron todos, al final.
 */
export function nowMarkerIndex(items: Pick<AgendaItem, "time">[], nowTime: string): number {
  const i = items.findIndex((item) => item.time > nowTime);
  return i === -1 ? items.length : i;
}
