import "server-only";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { vikRentCarUnixToUtc } from "@/lib/datetime";
import { resolveLocale } from "@/lib/i18n/config";
import type { RawBooking, RawOptional } from "./types";
import { resolveOptionals } from "./optionals";
import { effectiveClientName } from "./client-name";

export type Outcome = "imported" | "updated" | "cancelled" | "skipped";

export async function upsertBooking(b: RawBooking, optionals: RawOptional[] = []): Promise<Outcome> {
  const existing = await prisma.rental.findUnique({
    where: { wpBookingId: b.wpBookingId },
    include: { inspections: { select: { id: true }, take: 1 } },
  });
  const hasInspection = (existing?.inspections.length ?? 0) > 0;

  // Cancelación: solo si aún no hay entrega registrada (inmutabilidad).
  if (b.status === "cancelled") {
    if (!existing) return "skipped";
    if (hasInspection || existing.status === "cancelled") return "skipped";
    await prisma.rental.update({
      where: { id: existing.id },
      data: { status: "cancelled" },
    });
    return "cancelled";
  }

  // Solo importamos confirmadas (y standby si está habilitado).
  if (b.status !== "confirmed" && !(b.status === "standby" && env.sync.includeStandby)) {
    return "skipped";
  }

  const vehicleId = await resolveVehicleId(b.idcar, b.carindex);
  const language = resolveLocale(b.lang);
  const startAt = vikRentCarUnixToUtc(b.startUnix);
  const endAt = vikRentCarUnixToUtc(b.endUnix);
  const booking = bookingFacts(b, optionals);
  // Si no hay nombre real, se toma de la 1ª línea de la nota (convención del staff).
  const clientName = effectiveClientName(b.clientName, b.custData);

  if (!existing) {
    await prisma.rental.create({
      data: {
        origin: "vikrentcar",
        wpBookingId: b.wpBookingId,
        status: "reserved",
        vehicleId,
        language,
        startAt,
        endAt,
        clientName,
        clientEmail: b.clientEmail,
        clientPhone: b.clientPhone,
        clientDocNumber: b.clientDocNumber,
        clientCountry: b.clientCountry,
        ...booking,
      },
    });
    return "imported";
  }

  // ¿Cambió la fecha de devolución en VikRentCar (extensión)? VikRentCar es la
  // única fuente de verdad de las fechas de una reserva importada: la edición de
  // fechas en Andes está deshabilitada para estas reservas, así que la web siempre
  // manda.
  const returnChangedInWp = endAt.getTime() !== existing.endAt.getTime();

  // No tocamos reservas que ya arrancaron el flujo físico (entrega/devolución) ni
  // las cerradas. ÚNICA excepción: si una reserva ACTIVA (entregada, sin devolución
  // aún) extendió su fecha de devolución en la web, traemos SOLO esa fecha.
  if (hasInspection || existing.status !== "reserved") {
    if (existing.status === "active" && returnChangedInWp) {
      await prisma.rental.update({ where: { id: existing.id }, data: { endAt } });
      return "updated";
    }
    return "skipped";
  }

  // Si el empleado ya editó la reserva a mano, el sync no pisa los datos del
  // cliente ni el vehículo asignado (VikRentCar deja de ser la verdad de esos
  // campos para esta reserva).
  const edited = existing.clientEditedAt != null;
  const clientData = edited
    ? {}
    : {
        clientName,
        clientEmail: b.clientEmail,
        clientPhone: b.clientPhone,
        clientDocNumber: b.clientDocNumber,
      };
  // El vehículo tampoco se pisa si fue editado; y NUNCA se limpia a null desde el
  // sync (las reservas de VikRentCar suelen venir sin unidad → carindex null →
  // resolveVehicleId null, que borraría la asignación manual).
  const vehicleData = !edited && vehicleId != null ? { vehicleId } : {};

  await prisma.rental.update({
    where: { id: existing.id },
    data: {
      language,
      startAt,
      endAt,
      ...vehicleData,
      ...clientData,
      ...booking,
    },
  });
  return "updated";
}

/**
 * Datos económicos de la orden (referencia para precargar/confirmar las
 * condiciones). NO son pricing del contrato: eso lo carga el empleado y el sync
 * nunca lo pisa. Ver docs/wordpress-mapping.md.
 */
function bookingFacts(b: RawBooking, optionals: RawOptional[] = []) {
  const perDay =
    b.carCost != null && b.days && b.days > 0
      ? Math.round((b.carCost / b.days) * 100) / 100
      : null;
  // Opcionales: packs de km → accesorios (desc + importe), mejora de seguro → flag.
  const opt = resolveOptionals(b.optionals, optionals, b.days);
  return {
    // `standby` entra sin confirmar (naranja); `confirmed` confirmada. Si el dueño
    // confirma en VikRentCar, el próximo sync la actualiza a true.
    bookingConfirmed: b.status === "confirmed",
    bookingDays: b.days,
    bookingTotal: b.orderTotal,
    bookingPaid: b.paid,
    bookingNote: b.custData,
    bookingPricePerDay: perDay,
    bookingModel: b.carName,
    bookingPickupPlace: b.pickupPlace,
    bookingReturnPlace: b.returnPlace,
    bookingAccessories: opt.accessoriesDesc,
    bookingAccessoriesAmount: opt.accessoriesAmount,
    bookingInsuranceUpgrade: opt.insuranceUpgrade,
    bookingPaymentMethod: b.paymentMethod,
  };
}

/** Mapea (idcar, carindex) → vehicle.id. `carindex` NULL → sin unidad asignada. */
async function resolveVehicleId(
  idcar: number | null,
  carindex: number | null,
): Promise<string | null> {
  if (idcar == null || carindex == null) return null;
  const v = await prisma.vehicle.findUnique({
    where: { wpCarId_wpCarIndex: { wpCarId: idcar, wpCarIndex: carindex } },
    select: { id: true },
  });
  return v?.id ?? null;
}
