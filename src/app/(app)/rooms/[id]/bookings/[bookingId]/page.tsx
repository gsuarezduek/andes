import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { hasAdminAccess, hasFinanceAccess } from "@/lib/user-permissions";
import { getBookingDetail, bookingGuestLabel } from "@/lib/rooms/queries";
import { nightsBetween } from "@/lib/rooms/dates";
import { roomSourceLabels } from "@/lib/rooms/feed-url";
import { formatMoney } from "@/lib/contract";
import { formatDateTime } from "@/lib/datetime";
import { getCurrentUsdRate, getUsdRateHistory } from "@/lib/usd-rate-queries";
import { paymentInCurrency, roomPaidTotal } from "@/lib/rooms/payments";
import { canVerifyRoomBooking, isRoomBookingVerified } from "@/lib/room-booking-verification";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { BookingForm } from "@/components/rooms/booking-form";
import { RoomPaymentForm } from "@/components/rooms/room-payment-form";
import { RoomBookingVerificationSection } from "@/components/rooms/room-booking-verification-section";
import { setManualBookingCancelled, updateBooking } from "../../../actions";

export const metadata: Metadata = { title: "Reserva de habitación — Andes" };

const fmt = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}/${k.slice(0, 4)}`;

export default async function RoomBookingPage({ params }: { params: Promise<{ id: string; bookingId: string }> }) {
  const { id, bookingId } = await params;
  const user = await requireUser();
  const isAdmin = hasAdminAccess(user.role);
  const canSeeFinanceOnly = hasFinanceAccess(user.role, user.owner);
  const detail = await getBookingDetail(id, bookingId);
  if (!detail) notFound();
  const { booking: b, room, payments, mirrored, verifiedAt, verifiedByName, verifications } = detail;

  const [rawPaymentMethods, usdRateInfo, usdHistory] = await Promise.all([
    prisma.paymentMethod.findMany({
      where: { active: true, ...(canSeeFinanceOnly ? {} : { financeOnly: false }) },
      orderBy: { ordering: "asc" },
      select: { id: true, name: true, adjustmentPercent: true, requiresNote: true, parentId: true },
    }),
    getCurrentUsdRate(),
    getUsdRateHistory(),
  ]);
  const paymentMethods = rawPaymentMethods.map((m) => ({
    ...m,
    adjustmentPercent: m.adjustmentPercent ? Number(m.adjustmentPercent) : undefined,
  }));
  const usdRate = usdRateInfo?.rate ?? null;

  const nights = nightsBetween(b.startDate, b.endDate);
  const imported = b.source !== "manual";
  // Cobrado en la moneda del total: un cobro en la otra moneda se convierte con
  // la cotización del cobro (o la de referencia a su fecha).
  const { paid, unconverted } = roomPaidTotal(payments, b.currency, usdHistory);
  const remaining = b.totalAmount > 0 ? Math.max(0, b.totalAmount - paid) : null;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link href={`/rooms/${id}`} className="text-sm text-foreground/60 hover:text-foreground">
          ← {room.name}
        </Link>
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight">
          {bookingGuestLabel(b)}
          <Badge tone={b.source === "airbnb" ? "red" : b.source === "booking" ? "blue" : "neutral"}>{roomSourceLabels[b.source]}</Badge>
          {b.isBlock ? <Badge tone="amber">Bloqueo</Badge> : null}
          {b.status === "cancelled" ? <Badge tone="red">Cancelada</Badge> : null}
        </h1>
        <p className="text-sm text-foreground/60">
          {fmt(b.startDate)} ({room.checkInTime}) → {fmt(b.endDate)} ({room.checkOutTime}) · {nights} noche{nights === 1 ? "" : "s"}
        </p>
        {mirrored ? (
          <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
            Otro canal tiene una reserva con las mismas fechas: se asume que es la misma estadía y en el Calendario se muestra una sola.
          </p>
        ) : null}
        {imported ? (
          <p className="text-xs text-foreground/50">
            Viene del calendario de {roomSourceLabels[b.source]}. Las fechas y la cancelación se manejan desde ahí; acá podés anotar huésped, notas y cobros.
          </p>
        ) : null}
        {imported && (b.externalLabel || b.externalDescription) ? (
          <details className="text-xs text-foreground/50">
            <summary className="cursor-pointer">Datos del calendario</summary>
            <p className="mt-1 whitespace-pre-wrap">
              {b.externalLabel}
              {b.externalDescription ? `\n${b.externalDescription}` : ""}
            </p>
          </details>
        ) : null}
      </div>

      {canVerifyRoomBooking(b.status, b.isBlock) && (
        <RoomBookingVerificationSection
          bookingId={b.id}
          verified={isRoomBookingVerified({ status: b.status, isBlock: b.isBlock, verifiedAt }) ? { byName: verifiedByName, at: verifiedAt! } : null}
          isAdmin={isAdmin}
          history={isAdmin ? verifications : []}
        />
      )}

      <section className="flex flex-col gap-3">
        <SectionHeading>Datos</SectionHeading>
        <div className="rounded-xl border border-foreground/10 p-4">
          <BookingForm
            action={updateBooking.bind(null, bookingId)}
            booking={{
              startDate: b.startDate,
              endDate: b.endDate,
              guestName: b.guestName,
              notes: b.notes,
              totalAmount: b.totalAmount,
              currency: b.currency,
              isBlock: b.isBlock,
            }}
            datesLocked={imported}
            submitLabel="Guardar cambios"
            suggestedRate={room.nightlyRate}
          />
        </div>
        {!imported ? (
          <form action={setManualBookingCancelled.bind(null, bookingId, b.status !== "cancelled")}>
            <Button type="submit" variant="secondary">
              {b.status === "cancelled" ? "Restaurar reserva" : "Cancelar reserva"}
            </Button>
          </form>
        ) : null}
        {detail.createdByName ? <p className="text-xs text-foreground/40">Cargada por {detail.createdByName}</p> : null}
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeading description="Van a Caja como ingresos vinculados a esta reserva.">Cobros</SectionHeading>
        {b.totalAmount > 0 ? (
          <p className="text-sm">
            Total {formatMoney(b.totalAmount, b.currency)} · cobrado {formatMoney(paid, b.currency)}
            {remaining != null ? (
              remaining > 0 ? (
                <span className="font-medium text-red-600"> · falta {formatMoney(remaining, b.currency)}</span>
              ) : (
                <span className="font-medium text-emerald-600"> · pagada</span>
              )
            ) : null}
          </p>
        ) : null}
        {unconverted > 0 ? (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {unconverted === 1 ? "Un cobro" : `${unconverted} cobros`} en otra moneda no se pudo convertir (no hay valor de referencia del USD cargado en Caja): no se descuenta del saldo.
          </p>
        ) : null}
        {payments.length > 0 ? (
          <ul className="divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10 text-sm">
            {payments.map((p) => (
              <li key={p.id} className="flex items-start justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate">{p.description}</p>
                  <p className="text-xs text-foreground/50">
                    {p.paymentMethodName} · {formatDateTime(p.createdAt)} · {p.createdByName ?? "—"}
                  </p>
                  {p.currency !== b.currency ? <ConvertedNote payment={p} target={b.currency} history={usdHistory} /> : null}
                </div>
                <span className="shrink-0 font-medium text-emerald-600">{formatMoney(p.amount, p.currency)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-foreground/50">Todavía no hay cobros registrados.</p>
        )}
        <RoomPaymentForm bookingId={bookingId} paymentMethods={paymentMethods} bookingCurrency={b.currency} usdRate={usdRate} />
      </section>
    </div>
  );
}

/** "≈ US$ 100 a $ 1.535" para un cobro hecho en otra moneda que el total. */
function ConvertedNote({
  payment,
  target,
  history,
}: {
  payment: Parameters<typeof paymentInCurrency>[0];
  target: "ars" | "usd";
  history: Parameters<typeof paymentInCurrency>[2];
}) {
  const value = paymentInCurrency(payment, target, history);
  if (value == null) return null;
  const rate = payment.exchangeRate;
  return (
    <p className="text-xs text-foreground/50">
      ≈ {formatMoney(value, target)}
      {rate != null ? ` a ${formatMoney(rate, "ars")}` : " (cotización de referencia)"}
    </p>
  );
}
