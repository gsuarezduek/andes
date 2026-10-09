import "server-only";
import { prisma } from "@/lib/prisma";

export type ThirdPartyVehicleBookingView = {
  id: string;
  vehicleId: string;
  clientName: string;
  clientPhone: string | null;
  startAt: Date;
  endAt: Date;
  notes: string | null;
  totalAmount: number;
  currency: "ars" | "usd";
  status: "confirmed" | "cancelled";
  createdByName: string | null;
  createdAt: Date;
};

type RawBooking = {
  id: string;
  vehicleId: string;
  clientName: string;
  clientPhone: string | null;
  startAt: Date;
  endAt: Date;
  notes: string | null;
  totalAmount: unknown;
  currency: "ars" | "usd";
  status: "confirmed" | "cancelled";
  createdByName: string | null;
  createdAt: Date;
};

export function toBookingView(b: RawBooking): ThirdPartyVehicleBookingView {
  return {
    id: b.id,
    vehicleId: b.vehicleId,
    clientName: b.clientName,
    clientPhone: b.clientPhone,
    startAt: b.startAt,
    endAt: b.endAt,
    notes: b.notes,
    totalAmount: Number(b.totalAmount),
    currency: b.currency,
    status: b.status,
    createdByName: b.createdByName,
    createdAt: b.createdAt,
  };
}

export type ThirdPartyVehicleListItem = {
  id: string;
  plate: string;
  brand: string;
  model: string;
  ownerName: string;
  archived: boolean;
  /** Reserva en curso o próxima (la primera confirmada que no terminó). */
  current: { clientName: string; startAt: Date; endAt: Date; inProgress: boolean } | null;
};

export async function listThirdPartyVehicles(opts: { archived: boolean }): Promise<ThirdPartyVehicleListItem[]> {
  const now = new Date();
  const vehicles = await prisma.thirdPartyVehicle.findMany({
    where: { archivedAt: opts.archived ? { not: null } : null },
    orderBy: [{ sortOrder: "asc" }, { brand: "asc" }, { model: "asc" }],
    include: {
      bookings: {
        where: { status: "confirmed", endAt: { gte: now } },
        orderBy: { startAt: "asc" },
        take: 1,
      },
    },
  });
  return vehicles.map((v) => {
    const next = v.bookings[0];
    return {
      id: v.id,
      plate: v.plate,
      brand: v.brand,
      model: v.model,
      ownerName: v.ownerName,
      archived: v.archivedAt != null,
      current: next
        ? { clientName: next.clientName, startAt: next.startAt, endAt: next.endAt, inProgress: next.startAt <= now }
        : null,
    };
  });
}

export async function getThirdPartyVehicleDetail(id: string) {
  const vehicle = await prisma.thirdPartyVehicle.findUnique({
    where: { id },
    include: { bookings: { orderBy: { startAt: "desc" } } },
  });
  if (!vehicle) return null;
  return {
    vehicle: {
      id: vehicle.id,
      plate: vehicle.plate,
      brand: vehicle.brand,
      model: vehicle.model,
      year: vehicle.year,
      color: vehicle.color,
      ownerName: vehicle.ownerName,
      ownerPhone: vehicle.ownerPhone,
      notes: vehicle.notes,
      sortOrder: vehicle.sortOrder,
      archived: vehicle.archivedAt != null,
    },
    bookings: vehicle.bookings.map(toBookingView),
  };
}

export async function getThirdPartyVehicleBookingDetail(vehicleId: string, bookingId: string) {
  const booking = await prisma.thirdPartyVehicleBooking.findFirst({
    where: { id: bookingId, vehicleId },
    include: {
      vehicle: { select: { id: true, plate: true, brand: true, model: true, ownerName: true, ownerPhone: true } },
      cashMovements: { where: { deletedAt: null }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!booking) return null;
  return {
    booking: toBookingView(booking),
    vehicle: booking.vehicle,
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
