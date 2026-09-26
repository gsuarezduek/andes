"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/auth-helpers";
import { displayName } from "@/lib/user-display";
import { syncCommission } from "@/lib/commissions-sync";
import { validateFeedUrl, FEED_SOURCES, roomSourceLabels } from "@/lib/rooms/feed-url";
import { syncRoomFeed } from "@/lib/rooms/sync";
import { isDateKey, keyToDate, nightsBetween, rangesOverlap } from "@/lib/rooms/dates";
import { toBookingViews, bookingGuestLabel } from "@/lib/rooms/queries";

export type FormState = { error?: string; ok?: string };

const optionalStr = z.preprocess(
  (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null),
  z.string().nullable(),
);
const optionalInt = z.preprocess(
  (v) => (v === "" || v == null ? null : Number(v)),
  z.number({ error: "Debe ser un número" }).int().positive().nullable(),
);
const optionalMoney = z.preprocess(
  (v) => (v === "" || v == null ? null : Number(v)),
  z.number({ error: "Debe ser un número" }).nonnegative().nullable(),
);
const timeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horario inválido (HH:MM)");

const roomSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(80),
  description: optionalStr,
  capacity: optionalInt,
  nightlyRate: optionalMoney,
  checkInTime: timeStr,
  checkOutTime: timeStr,
  sortOrder: optionalInt,
  notes: optionalStr,
});

function parseRoom(formData: FormData) {
  return roomSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    capacity: formData.get("capacity"),
    nightlyRate: formData.get("nightlyRate"),
    checkInTime: formData.get("checkInTime") || "14:00",
    checkOutTime: formData.get("checkOutTime") || "10:00",
    sortOrder: formData.get("sortOrder"),
    notes: formData.get("notes"),
  });
}

export async function createRoom(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = parseRoom(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const room = await prisma.room.create({ data: parsed.data });
  revalidatePath("/rooms");
  revalidatePath("/calendar");
  redirect(`/rooms/${room.id}`);
}

export async function updateRoom(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = parseRoom(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  await prisma.room.update({ where: { id }, data: parsed.data });
  revalidatePath("/rooms");
  revalidatePath(`/rooms/${id}`);
  revalidatePath("/calendar");
  redirect(`/rooms/${id}`);
}

/** Archivar saca la habitación del calendario y del sync, sin borrar el histórico. */
export async function setRoomArchived(id: string, archived: boolean): Promise<void> {
  await requireAdmin();
  await prisma.room.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
  revalidatePath("/rooms");
  revalidatePath(`/rooms/${id}`);
  revalidatePath("/calendar");
}

// ---------------------------------------------------------------------------
// Calendarios iCal (Airbnb / Booking)
// ---------------------------------------------------------------------------

export async function addFeed(roomId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const source = z.enum(FEED_SOURCES).safeParse(formData.get("source"));
  if (!source.success) return { error: "Elegí de dónde viene el calendario." };
  const url = validateFeedUrl(String(formData.get("url") ?? ""));
  if (!url.ok) return { error: url.error };

  const dup = await prisma.roomCalendarFeed.findFirst({ where: { roomId, url: url.url } });
  if (dup) return { error: "Ese calendario ya está cargado en esta habitación." };

  const feed = await prisma.roomCalendarFeed.create({ data: { roomId, source: source.data, url: url.url } });
  // Primera lectura al toque, para ver enseguida si el link funciona.
  const result = await syncRoomFeed(feed.id);
  revalidatePath(`/rooms/${roomId}`);
  revalidatePath("/calendar");
  if (!result.ok) {
    return { error: `El calendario se guardó pero no se pudo leer: ${result.message}` };
  }
  return { ok: `${roomSourceLabels[source.data]} conectado — ${result.message}` };
}

/**
 * Quita un calendario. Las reservas que importó y no tienen cobros se borran
 * (ya no hay quien las mantenga al día); las que tienen cobros de Caja se
 * conservan, desligadas del feed.
 */
export async function removeFeed(feedId: string): Promise<void> {
  await requireAdmin();
  const feed = await prisma.roomCalendarFeed.findUnique({ where: { id: feedId }, select: { roomId: true } });
  if (!feed) return;
  await prisma.$transaction(async (tx) => {
    await tx.roomBooking.deleteMany({ where: { feedId, cashMovements: { none: {} } } });
    await tx.roomBooking.updateMany({ where: { feedId }, data: { feedId: null } });
    await tx.roomCalendarFeed.delete({ where: { id: feedId } });
  });
  revalidatePath(`/rooms/${feed.roomId}`);
  revalidatePath("/calendar");
}

/** "Sincronizar ahora" de una habitación (cualquier usuario, como el sync de VikRentCar). */
export async function syncRoomNow(roomId: string): Promise<void> {
  await requireUser();
  const feeds = await prisma.roomCalendarFeed.findMany({ where: { roomId, active: true }, select: { id: true } });
  for (const f of feeds) await syncRoomFeed(f.id);
  revalidatePath(`/rooms/${roomId}`);
  revalidatePath("/calendar");
}

// ---------------------------------------------------------------------------
// Reservas manuales (directas, o para anotar a mano lo que no viene por iCal)
// ---------------------------------------------------------------------------

const bookingSchema = z.object({
  startDate: z.string().refine(isDateKey, "Fecha de entrada inválida"),
  endDate: z.string().refine(isDateKey, "Fecha de salida inválida"),
  guestName: optionalStr,
  notes: optionalStr,
  totalAmount: optionalMoney,
  currency: z.enum(["ars", "usd"]).default("ars"),
  isBlock: z.boolean().default(false),
});

/** Primera reserva activa (no espejo) de la habitación que se pisa con el rango, si hay. */
async function findConflict(roomId: string, start: string, end: string, excludeId?: string) {
  const rows = await prisma.roomBooking.findMany({
    where: {
      roomId,
      status: "confirmed",
      startDate: { lt: keyToDate(end) },
      endDate: { gt: keyToDate(start) },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
  const all = await prisma.roomBooking.findMany({ where: { roomId, status: "confirmed" } });
  const mirrored = new Set(toBookingViews(all).filter((v) => v.mirrored).map((v) => v.id));
  return rows.find((r) => !mirrored.has(r.id) && rangesOverlap(start, end, r.startDate.toISOString().slice(0, 10), r.endDate.toISOString().slice(0, 10))) ?? null;
}

function parseBooking(formData: FormData) {
  return bookingSchema.safeParse({
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    guestName: formData.get("guestName"),
    notes: formData.get("notes"),
    totalAmount: formData.get("totalAmount"),
    currency: formData.get("currency") || undefined,
    isBlock: formData.get("isBlock") === "on",
  });
}

function checkRange(start: string, end: string): string | null {
  if (end <= start) return "La salida tiene que ser posterior a la entrada.";
  if (nightsBetween(start, end) > 365) return "La estadía no puede superar 365 noches.";
  return null;
}

export async function createManualBooking(roomId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = parseBooking(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const d = parsed.data;
  const rangeError = checkRange(d.startDate, d.endDate);
  if (rangeError) return { error: rangeError };

  if (formData.get("allowOverlap") !== "on") {
    const clash = await findConflict(roomId, d.startDate, d.endDate);
    if (clash) {
      return {
        error: `Se superpone con otra reserva (${clash.startDate.toISOString().slice(0, 10)} → ${clash.endDate.toISOString().slice(0, 10)}). Marcá «Guardar igual» si es a propósito.`,
      };
    }
  }

  const booking = await prisma.roomBooking.create({
    data: {
      roomId,
      source: "manual",
      startDate: keyToDate(d.startDate),
      endDate: keyToDate(d.endDate),
      guestName: d.guestName,
      notes: d.notes,
      totalAmount: d.totalAmount ?? 0,
      currency: d.currency,
      isBlock: d.isBlock,
      createdById: user.id,
      createdByName: displayName(user),
    },
  });
  revalidatePath(`/rooms/${roomId}`);
  revalidatePath("/calendar");
  redirect(`/rooms/${roomId}/bookings/${booking.id}`);
}

/**
 * Edita una reserva. Las importadas por iCal solo aceptan huésped, notas y
 * total (fechas y estado los manda el calendario de origen, y el próximo sync
 * los pisaría).
 */
export async function updateBooking(bookingId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireUser();
  const existing = await prisma.roomBooking.findUnique({ where: { id: bookingId } });
  if (!existing) return { error: "La reserva no existe." };
  const parsed = parseBooking(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const d = parsed.data;

  const data: Record<string, unknown> = {
    guestName: d.guestName,
    notes: d.notes,
    totalAmount: d.totalAmount ?? 0,
    currency: d.currency,
  };
  if (existing.source === "manual") {
    const rangeError = checkRange(d.startDate, d.endDate);
    if (rangeError) return { error: rangeError };
    if (formData.get("allowOverlap") !== "on") {
      const clash = await findConflict(existing.roomId, d.startDate, d.endDate, existing.id);
      if (clash) {
        return { error: "Se superpone con otra reserva. Marcá «Guardar igual» si es a propósito." };
      }
    }
    data.startDate = keyToDate(d.startDate);
    data.endDate = keyToDate(d.endDate);
    data.isBlock = d.isBlock;
  }
  await prisma.roomBooking.update({ where: { id: bookingId }, data });
  revalidatePath(`/rooms/${existing.roomId}`);
  revalidatePath(`/rooms/${existing.roomId}/bookings/${bookingId}`);
  revalidatePath("/calendar");
  return { ok: "Guardado." };
}

/** Cancela / restaura una reserva MANUAL (las importadas se cancelan en Airbnb/Booking). */
export async function setManualBookingCancelled(bookingId: string, cancelled: boolean): Promise<void> {
  await requireUser();
  const b = await prisma.roomBooking.findUnique({ where: { id: bookingId } });
  if (!b || b.source !== "manual") return;
  await prisma.roomBooking.update({
    where: { id: bookingId },
    data: { status: cancelled ? "cancelled" : "confirmed", cancelledAt: cancelled ? new Date() : null },
  });
  revalidatePath(`/rooms/${b.roomId}`);
  revalidatePath(`/rooms/${b.roomId}/bookings/${bookingId}`);
  revalidatePath("/calendar");
}

// ---------------------------------------------------------------------------
// Cobros (van a Caja)
// ---------------------------------------------------------------------------

const paymentSchema = z.object({
  amount: z.coerce.number().positive("El monto tiene que ser mayor a 0"),
  currency: z.enum(["ars", "usd"]).default("ars"),
  paymentMethodId: z.string().min(1, "Elegí el medio de pago"),
  paymentMethodNote: z.string().trim().max(300).optional(),
  detail: z.string().trim().max(300).optional(),
});

/**
 * Registra un cobro de una estadía como un ingreso de Caja vinculado a la
 * reserva. Sirve para efectivo cobrado en mano y para lo que Airbnb/Booking
 * acreditan en una cuenta (que se elige como medio de pago, ej. "Airbnb").
 */
export async function addRoomPayment(bookingId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = paymentSchema.safeParse({
    amount: formData.get("amount"),
    currency: formData.get("currency") || undefined,
    paymentMethodId: formData.get("paymentMethodId"),
    paymentMethodNote: formData.get("paymentMethodNote") || undefined,
    detail: formData.get("detail") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const p = parsed.data;

  const booking = await prisma.roomBooking.findUnique({ where: { id: bookingId }, include: { room: true } });
  if (!booking) return { error: "La reserva no existe." };
  const method = await prisma.paymentMethod.findUnique({ where: { id: p.paymentMethodId } });
  if (!method) return { error: "Medio de pago inválido." };
  if (method.requiresNote && !p.paymentMethodNote) {
    return { error: "Este medio de pago requiere indicar a dónde fue." };
  }

  const roomLabel = /^habitaci[oó]n/i.test(booking.room.name) ? booking.room.name : `Habitación ${booking.room.name}`;
  const description = `${roomLabel} — ${bookingGuestLabel(booking)}${p.detail ? ` · ${p.detail}` : ""}`;
  await prisma.$transaction(async (tx) => {
    const created = await tx.cashMovement.create({
      data: {
        type: "income",
        description,
        amount: p.amount,
        currency: p.currency,
        paymentMethodId: method.id,
        paymentMethodName: method.name,
        paymentMethodNote: method.requiresNote ? p.paymentMethodNote : null,
        roomBookingId: booking.id,
        createdById: user.id,
        createdByName: displayName(user),
      },
    });
    await syncCommission(tx, created.id, { id: user.id, name: displayName(user) });
  });
  revalidatePath(`/rooms/${booking.roomId}/bookings/${bookingId}`);
  revalidatePath("/caja");
  return { ok: "Cobro registrado en Caja." };
}
