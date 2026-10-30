import "server-only";
import { prisma } from "@/lib/prisma";
import { formatTime, mendozaWallTimeToUtc } from "@/lib/datetime";
import { placeCode } from "@/lib/place-code";
import { vehicleLabelWithPlate } from "@/lib/vehicle-ui";
import { computeRentalPayments, paymentAccent } from "@/lib/rental-payments";
import { addDaysToKey } from "@/lib/rooms/ical";
import { keyToDate } from "@/lib/rooms/dates";
import { bookingGuestLabel, countsAsOccupancy, toBookingViews } from "@/lib/rooms/queries";
import { roomSourceLabels } from "@/lib/rooms/feed-url";
import {
  agendaState,
  isOfficeReturn,
  sortAgenda,
  type AgendaItem,
  type AgendaRentalItem,
  type AgendaRoomItem,
} from "@/lib/agenda";

/** Margen de días alrededor del día pedido para detectar espejos entre canales (ver findMirroredIds). */
const MIRROR_WINDOW_DAYS = 30;

export type AgendaData = {
  /** Agenda principal (3/4): entregas, devoluciones fuera de la oficina, tareas con agenda y check-in. */
  timeline: AgendaItem[];
  /** Columna angosta (1/4): devoluciones en la oficina y check-out de habitaciones — no hay que salir. */
  office: (AgendaRentalItem | AgendaRoomItem)[];
};

/**
 * Agenda de un día (`dayKey`, "YYYY-MM-DD" en hora Mendoza). Sin caché, igual
 * que el resto del Home: es el estado operativo del día.
 */
export async function getAgenda(dayKey: string, now = new Date()): Promise<AgendaData> {
  const dayStart = mendozaWallTimeToUtc(`${dayKey}T00:00`);
  const dayEnd = mendozaWallTimeToUtc(`${addDaysToKey(dayKey, 1)}T00:00`);

  const rentalInclude = { vehicle: true, inspections: { select: { type: true } } } as const;
  const [handovers, returns, tasks, roomBookings] = await Promise.all([
    // Mismo criterio que tenía "Entregas/Devoluciones de hoy": sin canceladas
    // ni los placeholders "en service" (no son movimientos reales con un cliente).
    prisma.rental.findMany({
      where: { status: { notIn: ["cancelled", "out_of_service"] }, startAt: { gte: dayStart, lt: dayEnd } },
      include: rentalInclude,
    }),
    prisma.rental.findMany({
      where: { status: { notIn: ["cancelled", "out_of_service"] }, endAt: { gte: dayStart, lt: dayEnd } },
      include: rentalInclude,
    }),
    // Tareas con agenda de ese día, de todo el equipo (la agenda es para
    // coordinar), pendientes y hechas: las hechas quedan tachadas.
    prisma.task.findMany({
      where: { scheduledTime: { not: null }, dueDate: { gte: dayStart, lt: dayEnd } },
      include: {
        vehicle: { select: { id: true, name: true, brand: true, model: true, plate: true } },
        rental: { select: { id: true, clientName: true } },
        completedBy: { select: { name: true } },
      },
    }),
    // Ventana amplia (no solo el día) para poder reconocer las estadías espejo
    // de otro canal, que se solapan con la real pero no siempre con las mismas fechas.
    prisma.roomBooking.findMany({
      where: {
        status: "confirmed",
        room: { archivedAt: null },
        startDate: { lte: keyToDate(addDaysToKey(dayKey, MIRROR_WINDOW_DAYS)) },
        endDate: { gte: keyToDate(addDaysToKey(dayKey, -MIRROR_WINDOW_DAYS)) },
      },
      include: { room: { select: { id: true, name: true, checkInTime: true, checkOutTime: true } } },
    }),
  ]);

  const rentalItem = (
    r: (typeof handovers)[number],
    kind: "handover" | "return",
  ): AgendaRentalItem => {
    const at = kind === "handover" ? r.startAt : r.endAt;
    const done = kind === "handover" ? r.inspections.some((i) => i.type === "handover") : r.status === "finished";
    return {
      kind,
      key: `${kind}-${r.id}`,
      time: formatTime(at),
      rentalId: r.id,
      clientName: r.clientName,
      vehicleLabel: r.vehicle ? vehicleLabelWithPlate(r.vehicle) : null,
      place: placeCode(kind === "handover" ? r.bookingPickupPlace : r.bookingReturnPlace),
      state: agendaState(done, at, now),
      unconfirmed: !r.bookingConfirmed,
      accent: paymentAccent(r.status, r.bookingConfirmed, computeRentalPayments(r)),
    };
  };

  const timeline: AgendaItem[] = handovers.map((r) => rentalItem(r, "handover"));
  const office: (AgendaRentalItem | AgendaRoomItem)[] = [];
  for (const r of returns) {
    (isOfficeReturn(r.bookingReturnPlace) ? office : timeline).push(rentalItem(r, "return"));
  }

  for (const t of tasks) {
    const time = t.scheduledTime!;
    timeline.push({
      kind: "task",
      key: `task-${t.id}`,
      time,
      taskId: t.id,
      text: t.text,
      highPriority: t.priority === "high",
      assignedToName: t.assignedToName,
      vehicleId: t.vehicle?.id ?? null,
      vehicleLabel: t.vehicle ? vehicleLabelWithPlate(t.vehicle) : null,
      rentalId: t.rental?.id ?? null,
      rentalClientName: t.rental?.clientName ?? null,
      completedByName: t.completedBy?.name ?? null,
      state: agendaState(t.status === "done", mendozaWallTimeToUtc(`${dayKey}T${time}`), now),
    });
  }

  // Habitaciones: solo estadías reales (sin espejos de otro canal ni bloqueos
  // sincronizados) que entran o salen ese día — mismo criterio que el Calendario.
  const roomsById = new Map(roomBookings.map((b) => [b.id, b.room]));
  const views = toBookingViews(roomBookings).filter((b) => !b.mirrored && countsAsOccupancy(b));
  for (const b of views) {
    const room = roomsById.get(b.id)!;
    const base = {
      roomId: room.id,
      bookingId: b.id,
      roomName: room.name,
      guest: bookingGuestLabel(b),
      sourceLabel: roomSourceLabels[b.source],
    };
    if (b.startDate === dayKey) {
      timeline.push({ ...base, kind: "checkin", key: `checkin-${b.id}`, time: room.checkInTime });
    }
    if (b.endDate === dayKey) {
      office.push({ ...base, kind: "checkout", key: `checkout-${b.id}`, time: room.checkOutTime });
    }
  }

  return { timeline: sortAgenda(timeline), office: sortAgenda(office) };
}
