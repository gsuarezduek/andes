import "server-only";
import { prisma } from "@/lib/prisma";
import { formatDateInput } from "@/lib/datetime";
import { dateToKey } from "./dates";
import { findMirroredIds } from "./mirrors";
import { roomSourceLabels } from "./feed-url";

export type RoomBookingView = {
  id: string;
  roomId: string;
  source: "airbnb" | "booking" | "other" | "manual";
  startDate: string;
  endDate: string;
  guestName: string | null;
  externalLabel: string | null;
  externalDescription: string | null;
  isBlock: boolean;
  status: "confirmed" | "cancelled";
  notes: string | null;
  totalAmount: number;
  currency: "ars" | "usd";
  createdAt: Date;
  /** Otra reserva con las mismas fechas ya la representa (ver `findMirroredIds`). */
  mirrored: boolean;
};

type RawBooking = {
  id: string;
  roomId: string;
  source: RoomBookingView["source"];
  startDate: Date;
  endDate: Date;
  guestName: string | null;
  externalLabel: string | null;
  externalDescription: string | null;
  isBlock: boolean;
  status: "confirmed" | "cancelled";
  notes: string | null;
  totalAmount: unknown;
  currency: "ars" | "usd";
  createdAt: Date;
};

/** Pasa las filas de Prisma a la vista, marcando las que son espejo de otra. */
export function toBookingViews(rows: RawBooking[]): RoomBookingView[] {
  const views = rows.map((b) => ({
    id: b.id,
    roomId: b.roomId,
    source: b.source,
    startDate: dateToKey(b.startDate),
    endDate: dateToKey(b.endDate),
    guestName: b.guestName,
    externalLabel: b.externalLabel,
    externalDescription: b.externalDescription,
    isBlock: b.isBlock,
    status: b.status,
    notes: b.notes,
    totalAmount: Number(b.totalAmount),
    currency: b.currency,
    createdAt: b.createdAt,
    mirrored: false,
  }));
  const hidden = findMirroredIds(views);
  return views.map((v) => ({ ...v, mirrored: hidden.has(v.id) }));
}

export type RoomListItem = {
  id: string;
  name: string;
  capacity: number | null;
  nightlyRate: number | null;
  archived: boolean;
  feedCount: number;
  lastSyncAt: Date | null;
  lastSyncFailed: boolean;
  /** Próxima entrada (o la estadía en curso), para el listado. */
  current: { guest: string; startDate: string; endDate: string; inHouse: boolean } | null;
};

/** Rótulos genéricos que ponen Airbnb/Booking en vez de un nombre ("Reserved", "CLOSED - Not available"). */
const GENERIC_LABEL = /^(reserved|reservad[ao]|closed\b.*|.*not available.*)$/i;

/**
 * Cómo se nombra una estadía: el huésped si está cargado; si no, algo legible
 * ("Reserva de Airbnb") en vez del rótulo crudo del iCal, que casi nunca trae
 * un nombre.
 */
export function bookingGuestLabel(b: Pick<RoomBookingView, "guestName" | "externalLabel" | "isBlock" | "source">): string {
  if (b.guestName?.trim()) return b.guestName.trim();
  if (b.isBlock) return "Bloqueado";
  if (b.source === "manual") return "Reserva directa";
  const label = b.externalLabel?.trim();
  if (label && !GENERIC_LABEL.test(label)) return label;
  return `Reserva de ${roomSourceLabels[b.source]}`;
}

export async function listRooms(opts: { archived: boolean }): Promise<RoomListItem[]> {
  const todayKey = formatDateInput(new Date());
  const rooms = await prisma.room.findMany({
    where: { archivedAt: opts.archived ? { not: null } : null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      feeds: { select: { lastSyncAt: true, lastSyncOk: true, active: true } },
      bookings: {
        where: { status: "confirmed", endDate: { gte: new Date(`${todayKey}T00:00:00.000Z`) } },
        orderBy: { startDate: "asc" },
      },
    },
  });
  return rooms.map((r) => {
    const views = toBookingViews(r.bookings).filter((b) => !b.mirrored);
    const next = views[0];
    const syncTimes = r.feeds.map((f) => f.lastSyncAt).filter((d): d is Date => d != null);
    return {
      id: r.id,
      name: r.name,
      capacity: r.capacity,
      nightlyRate: r.nightlyRate == null ? null : Number(r.nightlyRate),
      archived: r.archivedAt != null,
      feedCount: r.feeds.length,
      lastSyncAt: syncTimes.length ? new Date(Math.max(...syncTimes.map((d) => d.getTime()))) : null,
      lastSyncFailed: r.feeds.some((f) => f.active && f.lastSyncOk === false),
      current: next
        ? {
            guest: bookingGuestLabel(next),
            startDate: next.startDate,
            endDate: next.endDate,
            inHouse: next.startDate <= todayKey,
          }
        : null,
    };
  });
}

export async function getRoomDetail(id: string) {
  const room = await prisma.room.findUnique({
    where: { id },
    include: {
      feeds: { orderBy: { createdAt: "asc" } },
      bookings: { orderBy: { startDate: "desc" } },
    },
  });
  if (!room) return null;
  return {
    room: {
      id: room.id,
      name: room.name,
      description: room.description,
      capacity: room.capacity,
      nightlyRate: room.nightlyRate == null ? null : Number(room.nightlyRate),
      checkInTime: room.checkInTime,
      checkOutTime: room.checkOutTime,
      notes: room.notes,
      sortOrder: room.sortOrder,
      archived: room.archivedAt != null,
    },
    feeds: room.feeds.map((f) => ({
      id: f.id,
      source: f.source,
      url: f.url,
      active: f.active,
      lastSyncAt: f.lastSyncAt,
      lastSyncOk: f.lastSyncOk,
      lastSyncMessage: f.lastSyncMessage,
    })),
    bookings: toBookingViews(room.bookings),
  };
}

export async function getBookingDetail(roomId: string, bookingId: string) {
  const booking = await prisma.roomBooking.findFirst({
    where: { id: bookingId, roomId },
    include: {
      room: { select: { id: true, name: true, checkInTime: true, checkOutTime: true, nightlyRate: true } },
      cashMovements: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!booking) return null;
  // ¿Otra reserva con las mismas fechas la representa? (para avisarlo en el detalle)
  const siblings = await prisma.roomBooking.findMany({ where: { roomId, status: "confirmed" } });
  const view = toBookingViews(siblings).find((v) => v.id === booking.id);
  return {
    booking: toBookingViews([booking])[0]!,
    mirrored: view?.mirrored ?? false,
    room: {
      id: booking.room.id,
      name: booking.room.name,
      checkInTime: booking.room.checkInTime,
      checkOutTime: booking.room.checkOutTime,
      nightlyRate: booking.room.nightlyRate == null ? null : Number(booking.room.nightlyRate),
    },
    createdByName: booking.createdByName,
    payments: booking.cashMovements
      .filter((m) => m.type === "income")
      .map((m) => ({
        id: m.id,
        description: m.description,
        amount: Number(m.amount),
        currency: m.currency,
        paymentMethodName: m.paymentMethodName,
        createdByName: m.createdByName,
        createdAt: m.createdAt,
      })),
  };
}
