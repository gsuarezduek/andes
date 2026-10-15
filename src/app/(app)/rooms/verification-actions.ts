"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { displayName } from "@/lib/user-display";
import { canVerifyRoomBooking } from "@/lib/room-booking-verification";

function revalidateBooking(roomId: string, bookingId: string) {
  revalidatePath(`/rooms/${roomId}/bookings/${bookingId}`);
  revalidatePath(`/rooms/${roomId}`);
  revalidatePath("/calendar");
}

/** Marca la reserva de habitación como verificada (solo admin). Solo estadías reales confirmadas (no bloqueos). */
export async function verifyRoomBooking(bookingId: string): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  const booking = await prisma.roomBooking.findUnique({
    where: { id: bookingId },
    select: { roomId: true, status: true, isBlock: true, verifiedAt: true },
  });
  if (!booking) return { error: "La reserva no existe." };
  if (!canVerifyRoomBooking(booking.status, booking.isBlock)) {
    return { error: "Solo se pueden verificar reservas confirmadas (no bloqueos ni canceladas)." };
  }
  if (booking.verifiedAt) return {}; // ya verificada (doble click / otra pestaña)

  const name = displayName(admin);
  await prisma.$transaction(async (tx) => {
    // Guarda contra la carrera de dos admins verificando a la vez: solo el
    // primero cambia la fila y deja constancia.
    const { count } = await tx.roomBooking.updateMany({
      where: { id: bookingId, verifiedAt: null },
      data: { verifiedAt: new Date(), verifiedById: admin.id, verifiedByName: name },
    });
    if (count > 0) {
      await tx.roomBookingVerification.create({
        data: { roomBookingId: bookingId, action: "verified", byId: admin.id, byName: name },
      });
    }
  });

  revalidateBooking(booking.roomId, bookingId);
  return {};
}

/** Quita la verificación (solo admin); queda en el historial. */
export async function unverifyRoomBooking(bookingId: string): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  const booking = await prisma.roomBooking.findUnique({ where: { id: bookingId }, select: { roomId: true } });
  if (!booking) return { error: "La reserva no existe." };

  const name = displayName(admin);
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.roomBooking.updateMany({
      where: { id: bookingId, verifiedAt: { not: null } },
      data: { verifiedAt: null, verifiedById: null, verifiedByName: null },
    });
    if (count > 0) {
      await tx.roomBookingVerification.create({
        data: { roomBookingId: bookingId, action: "unverified", byId: admin.id, byName: name },
      });
    }
  });

  revalidateBooking(booking.roomId, bookingId);
  return {};
}
