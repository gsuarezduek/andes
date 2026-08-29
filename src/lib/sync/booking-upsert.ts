import "server-only";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { vikRentCarUnixToUtc } from "@/lib/datetime";
import { resolveLocale } from "@/lib/i18n/config";
import { computeBalance, roundMoney, type ContractPricing, type RentalPayment } from "@/lib/contract";
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
    const rental = await prisma.rental.create({
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
    await upsertWpPaymentMethodCatalog(b.paymentMethod);
    await importBookingPayment(rental.id, null, b.paid, b.paymentMethod, b.wpBookingId, clientName);
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
  await upsertWpPaymentMethodCatalog(b.paymentMethod);
  await importBookingPayment(
    existing.id,
    existing.bookingPaidImportedAmount ? Number(existing.bookingPaidImportedAmount) : null,
    b.paid,
    b.paymentMethod,
    b.wpBookingId,
    clientName,
  );
  return "updated";
}

/**
 * Registra en el catálogo (`WpPaymentMethod`) un nombre de método de pago
 * visto en una reserva — no hay una tabla fija de gateways en VikRentCar, así
 * que se completa solo a medida que aparecen nombres reales. Idempotente.
 */
async function upsertWpPaymentMethodCatalog(name: string | null): Promise<void> {
  if (!name) return;
  await prisma.wpPaymentMethod.upsert({
    where: { name },
    create: { name },
    update: {},
  });
}

/**
 * Si el nombre de VikRentCar está mapeado a exactamente UN medio de pago de
 * Andes, se puede confirmar solo; con 0 o 2+ opciones queda "sin confirmar"
 * (alguien tiene que elegir a mano, ver `confirmCashMovementPaymentMethod`).
 */
async function resolveWpPaymentMethod(
  name: string | null,
): Promise<{ id: string; name: string; adjustmentPercent: number | null } | null> {
  if (!name) return null;
  const wp = await prisma.wpPaymentMethod.findUnique({
    where: { name },
    include: { paymentMethods: { select: { id: true, name: true, adjustmentPercent: true } } },
  });
  if (wp?.paymentMethods.length === 1) {
    const m = wp.paymentMethods[0];
    return { id: m.id, name: m.name, adjustmentPercent: m.adjustmentPercent != null ? Number(m.adjustmentPercent) : null };
  }
  return null;
}

/**
 * Importa a Caja lo que se cobró de una reserva en VikRentCar (`totpaid`),
 * como ingreso — solo la DIFERENCIA respecto de lo ya importado en una corrida
 * anterior (`bookingPaidImportedAmount`), para no duplicar si el monto sigue
 * creciendo entre syncs. Agrega la línea a `rental.pricing.payments` (mismo
 * lugar que "Agregar pago") para que el wizard de entrega ya la vea cargada.
 * Si el medio de pago no se puede resolver (ver `resolveWpPaymentMethod`), el
 * movimiento queda marcado `needsConfirmation` para que cualquier usuario lo
 * confirme desde Caja.
 */
export async function importBookingPayment(
  rentalId: string,
  priorImported: number | null,
  newPaid: number | null,
  wpPaymentMethodName: string | null,
  wpBookingId: number | null,
  clientName: string,
): Promise<void> {
  const prior = priorImported ?? 0;
  const target = newPaid ?? 0;
  const delta = roundMoney(target - prior);
  if (delta <= 0.01) return;

  const resolved = await resolveWpPaymentMethod(wpPaymentMethodName);
  const methodName =
    resolved?.name ??
    (wpPaymentMethodName ? `${wpPaymentMethodName} (VikRentCar, sin confirmar)` : "Sin confirmar (VikRentCar)");
  const needsConfirmation = resolved == null;

  await prisma.$transaction(async (tx) => {
    const movement = await tx.cashMovement.create({
      data: {
        type: "income",
        description: `Seña — reserva VikRentCar${wpBookingId ? ` #${wpBookingId}` : ""} (${clientName})`,
        amount: delta,
        paymentMethodId: resolved?.id ?? null,
        paymentMethodName: methodName,
        needsConfirmation,
        rentalId,
      },
    });

    const rental = await tx.rental.findUnique({ where: { id: rentalId }, select: { pricing: true } });
    const pricing = (rental?.pricing ?? {}) as ContractPricing;
    // `delta` es lo realmente cobrado (adjustedAmount, ya reflejado en el
    // CashMovement de arriba). Si el medio resuelto tiene % (ej. recargo de
    // tarjeta), la base se calcula hacia atrás — es lo que cuenta para
    // "Paga"/Saldo, ver `RentalPayment` en contract.ts. Sin medio resuelto
    // (needsConfirmation) no hay % que aplicar todavía: base = delta, y se
    // recalcula cuando alguien confirme el medio real (ver
    // `confirmCashMovementPaymentMethod`).
    const pct = resolved?.adjustmentPercent ?? null;
    const amount = pct ? roundMoney(delta / (1 + pct / 100)) : delta;
    const payment: RentalPayment = {
      methodId: resolved?.id,
      methodName,
      adjustmentPercent: pct ?? undefined,
      amount,
      adjustedAmount: delta,
      cashMovementId: movement.id,
      unconfirmed: needsConfirmation,
    };
    const nextPayments = [...(pricing.payments ?? []), payment];
    const nextPaid = roundMoney(nextPayments.reduce((sum, p) => sum + p.amount, 0));
    const nextPricing: ContractPricing = { ...pricing, payments: nextPayments, paid: nextPaid };
    if (pricing.total != null) {
      nextPricing.balance = computeBalance({ total: pricing.total, sena: pricing.sena, paid: nextPaid }) ?? undefined;
    }

    await tx.rental.update({
      where: { id: rentalId },
      data: { pricing: nextPricing, bookingPaidImportedAmount: target },
    });
  });
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
    // Cuándo se cargó la reserva en VikRentCar (hora real de Mendoza, no cruda:
    // se muestra al empleado, a diferencia de otros usos de `ts` referenciales).
    bookingCreatedAt: b.createdUnix != null ? vikRentCarUnixToUtc(b.createdUnix) : null,
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

/**
 * Mapea (idcar, carindex) → vehicle.id. `carindex` NULL → sin unidad asignada.
 * Excluye archivados: son de baja operativa (el dueño ya no los tiene en la
 * calle) y no deberían recibir asignaciones nuevas del sync.
 */
async function resolveVehicleId(
  idcar: number | null,
  carindex: number | null,
): Promise<string | null> {
  if (idcar == null || carindex == null) return null;
  const v = await prisma.vehicle.findFirst({
    where: { wpCarId: idcar, wpCarIndex: carindex, archivedAt: null },
    select: { id: true },
  });
  return v?.id ?? null;
}
