"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/auth-helpers";
import { displayName } from "@/lib/user-display";
import { syncCommission } from "@/lib/commissions-sync";
import { mendozaWallTimeToUtc } from "@/lib/datetime";

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

// ---------------------------------------------------------------------------
// Vehículo de tercero
// ---------------------------------------------------------------------------

const vehicleSchema = z.object({
  plate: z.string().trim().min(1, "La patente es obligatoria").max(20),
  brand: z.string().trim().min(1, "La marca es obligatoria").max(40),
  model: z.string().trim().min(1, "El modelo es obligatorio").max(40),
  year: optionalInt,
  color: optionalStr,
  ownerName: z.string().trim().min(1, "El nombre del titular es obligatorio").max(80),
  ownerPhone: optionalStr,
  sortOrder: optionalInt,
  notes: optionalStr,
});

function parseVehicle(formData: FormData) {
  return vehicleSchema.safeParse({
    plate: formData.get("plate"),
    brand: formData.get("brand"),
    model: formData.get("model"),
    year: formData.get("year"),
    color: formData.get("color"),
    ownerName: formData.get("ownerName"),
    ownerPhone: formData.get("ownerPhone"),
    sortOrder: formData.get("sortOrder"),
    notes: formData.get("notes"),
  });
}

export async function createThirdPartyVehicle(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = parseVehicle(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const vehicle = await prisma.thirdPartyVehicle.create({ data: parsed.data });
  revalidatePath("/third-party-vehicles");
  revalidatePath("/calendar");
  redirect(`/third-party-vehicles/${vehicle.id}`);
}

export async function updateThirdPartyVehicle(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const parsed = parseVehicle(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  await prisma.thirdPartyVehicle.update({ where: { id }, data: parsed.data });
  revalidatePath("/third-party-vehicles");
  revalidatePath(`/third-party-vehicles/${id}`);
  revalidatePath("/calendar");
  redirect(`/third-party-vehicles/${id}`);
}

/** Archivar saca el auto del Calendario sin borrar el histórico. */
export async function setThirdPartyVehicleArchived(id: string, archived: boolean): Promise<void> {
  await requireAdmin();
  await prisma.thirdPartyVehicle.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
  revalidatePath("/third-party-vehicles");
  revalidatePath(`/third-party-vehicles/${id}`);
  revalidatePath("/calendar");
}

// ---------------------------------------------------------------------------
// Reservas manuales
// ---------------------------------------------------------------------------

const bookingSchema = z.object({
  clientName: z.string().trim().min(1, "El nombre del cliente es obligatorio").max(120),
  clientPhone: optionalStr,
  startAt: z.string().min(1, "La fecha de retiro es obligatoria"),
  endAt: z.string().min(1, "La fecha de devolución es obligatoria"),
  notes: optionalStr,
  totalAmount: optionalMoney,
  currency: z.enum(["ars", "usd"]).default("ars"),
});

function parseBooking(formData: FormData) {
  return bookingSchema.safeParse({
    clientName: formData.get("clientName"),
    clientPhone: formData.get("clientPhone"),
    startAt: formData.get("startAt"),
    endAt: formData.get("endAt"),
    notes: formData.get("notes"),
    totalAmount: formData.get("totalAmount"),
    currency: formData.get("currency") || undefined,
  });
}

/** Otra reserva confirmada del mismo auto que se pisa con el rango, si hay. */
async function findConflict(vehicleId: string, start: Date, end: Date, excludeId?: string) {
  return prisma.thirdPartyVehicleBooking.findFirst({
    where: {
      vehicleId,
      status: "confirmed",
      startAt: { lt: end },
      endAt: { gt: start },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
}

export async function createThirdPartyVehicleBooking(
  vehicleId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = parseBooking(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const d = parsed.data;
  const startAt = mendozaWallTimeToUtc(d.startAt);
  const endAt = mendozaWallTimeToUtc(d.endAt);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) return { error: "Fechas inválidas" };
  if (endAt <= startAt) return { error: "La devolución tiene que ser posterior al retiro." };

  if (formData.get("allowOverlap") !== "on") {
    const clash = await findConflict(vehicleId, startAt, endAt);
    if (clash) {
      return { error: "Se superpone con otra reserva de este auto. Marcá «Guardar igual» si es a propósito." };
    }
  }

  const booking = await prisma.thirdPartyVehicleBooking.create({
    data: {
      vehicleId,
      clientName: d.clientName,
      clientPhone: d.clientPhone,
      startAt,
      endAt,
      notes: d.notes,
      totalAmount: d.totalAmount ?? 0,
      currency: d.currency,
      createdById: user.id,
      createdByName: displayName(user),
    },
  });
  revalidatePath(`/third-party-vehicles/${vehicleId}`);
  revalidatePath("/calendar");
  redirect(`/third-party-vehicles/${vehicleId}/bookings/${booking.id}`);
}

export async function updateThirdPartyVehicleBooking(
  bookingId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const existing = await prisma.thirdPartyVehicleBooking.findUnique({ where: { id: bookingId } });
  if (!existing) return { error: "La reserva no existe." };
  const parsed = parseBooking(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  const d = parsed.data;
  const startAt = mendozaWallTimeToUtc(d.startAt);
  const endAt = mendozaWallTimeToUtc(d.endAt);
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) return { error: "Fechas inválidas" };
  if (endAt <= startAt) return { error: "La devolución tiene que ser posterior al retiro." };

  if (formData.get("allowOverlap") !== "on") {
    const clash = await findConflict(existing.vehicleId, startAt, endAt, existing.id);
    if (clash) return { error: "Se superpone con otra reserva. Marcá «Guardar igual» si es a propósito." };
  }

  await prisma.thirdPartyVehicleBooking.update({
    where: { id: bookingId },
    data: {
      clientName: d.clientName,
      clientPhone: d.clientPhone,
      startAt,
      endAt,
      notes: d.notes,
      totalAmount: d.totalAmount ?? 0,
      currency: d.currency,
    },
  });
  revalidatePath(`/third-party-vehicles/${existing.vehicleId}`);
  revalidatePath(`/third-party-vehicles/${existing.vehicleId}/bookings/${bookingId}`);
  revalidatePath("/calendar");
  return { ok: "Guardado." };
}

export async function setThirdPartyVehicleBookingCancelled(bookingId: string, cancelled: boolean): Promise<void> {
  await requireUser();
  const b = await prisma.thirdPartyVehicleBooking.findUnique({ where: { id: bookingId } });
  if (!b) return;
  await prisma.thirdPartyVehicleBooking.update({
    where: { id: bookingId },
    data: { status: cancelled ? "cancelled" : "confirmed", cancelledAt: cancelled ? new Date() : null },
  });
  revalidatePath(`/third-party-vehicles/${b.vehicleId}`);
  revalidatePath(`/third-party-vehicles/${b.vehicleId}/bookings/${bookingId}`);
  revalidatePath("/calendar");
}

// ---------------------------------------------------------------------------
// Cobros (van a Caja) — mismo patrón que addRoomPayment
// ---------------------------------------------------------------------------

const paymentSchema = z.object({
  amount: z.coerce.number().positive("El monto tiene que ser mayor a 0"),
  currency: z.enum(["ars", "usd"]).default("ars"),
  paymentMethodId: z.string().min(1, "Elegí el medio de pago"),
  paymentMethodNote: z.string().trim().max(300).optional(),
  detail: z.string().trim().max(300).optional(),
});

export async function addThirdPartyVehiclePayment(
  bookingId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
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

  const booking = await prisma.thirdPartyVehicleBooking.findUnique({ where: { id: bookingId }, include: { vehicle: true } });
  if (!booking) return { error: "La reserva no existe." };
  const method = await prisma.paymentMethod.findUnique({ where: { id: p.paymentMethodId } });
  if (!method) return { error: "Medio de pago inválido." };
  if (method.requiresNote && !p.paymentMethodNote) {
    return { error: "Este medio de pago requiere indicar a dónde fue." };
  }

  const description = `${booking.vehicle.plate} (tercero) — ${booking.clientName}${p.detail ? ` · ${p.detail}` : ""}`;
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
        thirdPartyVehicleBookingId: booking.id,
        createdById: user.id,
        createdByName: displayName(user),
      },
    });
    await syncCommission(tx, created.id, { id: user.id, name: displayName(user) });
  });
  revalidatePath(`/third-party-vehicles/${booking.vehicleId}/bookings/${bookingId}`);
  revalidatePath("/caja");
  return { ok: "Cobro registrado en Caja." };
}
