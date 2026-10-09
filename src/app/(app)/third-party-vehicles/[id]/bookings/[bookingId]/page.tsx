import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { getThirdPartyVehicleBookingDetail } from "@/lib/third-party-vehicles/queries";
import { formatDateTime, formatDateTimeInput } from "@/lib/datetime";
import { formatMoney } from "@/lib/contract";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { ThirdPartyBookingForm } from "@/components/third-party-vehicles/booking-form";
import { ThirdPartyPaymentForm } from "@/components/third-party-vehicles/payment-form";
import { setThirdPartyVehicleBookingCancelled, updateThirdPartyVehicleBooking } from "../../../actions";

export const metadata: Metadata = { title: "Reserva de vehículo de tercero — Andes" };

export default async function ThirdPartyVehicleBookingPage({
  params,
}: {
  params: Promise<{ id: string; bookingId: string }>;
}) {
  const { id, bookingId } = await params;
  await requireUser();
  const detail = await getThirdPartyVehicleBookingDetail(id, bookingId);
  if (!detail) notFound();
  const { booking: b, vehicle, payments } = detail;

  const paymentMethods = await prisma.paymentMethod.findMany({
    where: { active: true },
    orderBy: { ordering: "asc" },
    select: { id: true, name: true, requiresNote: true, parentId: true },
  });

  // Cobrado por moneda (nunca se suman monedas distintas).
  const paid = { ars: 0, usd: 0 };
  for (const p of payments) paid[p.currency] += p.amount;
  const remaining = b.totalAmount > 0 ? b.totalAmount - paid[b.currency] : null;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Link href={`/third-party-vehicles/${id}`} className="text-sm text-foreground/60 hover:text-foreground">
          ← {vehicle.plate} · {vehicle.brand} {vehicle.model}
        </Link>
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight">
          {b.clientName}
          {b.status === "cancelled" ? <Badge tone="red">Cancelada</Badge> : null}
        </h1>
        <p className="text-sm text-foreground/60">
          {formatDateTime(b.startAt)} → {formatDateTime(b.endAt)}
        </p>
        <p className="text-xs text-foreground/50">Titular del auto: {vehicle.ownerName}{vehicle.ownerPhone ? ` · ${vehicle.ownerPhone}` : ""}</p>
      </div>

      <section className="flex flex-col gap-3">
        <SectionHeading>Datos</SectionHeading>
        <div className="rounded-xl border border-foreground/10 p-4">
          <ThirdPartyBookingForm
            action={updateThirdPartyVehicleBooking.bind(null, bookingId)}
            booking={{
              clientName: b.clientName,
              clientPhone: b.clientPhone,
              startAt: formatDateTimeInput(b.startAt),
              endAt: formatDateTimeInput(b.endAt),
              notes: b.notes,
              totalAmount: b.totalAmount,
              currency: b.currency,
            }}
            submitLabel="Guardar cambios"
          />
        </div>
        <form action={setThirdPartyVehicleBookingCancelled.bind(null, bookingId, b.status !== "cancelled")}>
          <Button type="submit" variant="secondary">
            {b.status === "cancelled" ? "Restaurar reserva" : "Cancelar reserva"}
          </Button>
        </form>
        {b.createdByName ? <p className="text-xs text-foreground/40">Cargada por {b.createdByName}</p> : null}
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeading description="Van a Caja como ingresos vinculados a esta reserva.">Cobros</SectionHeading>
        {b.totalAmount > 0 ? (
          <p className="text-sm">
            Total {formatMoney(b.totalAmount, b.currency)} · cobrado {formatMoney(paid[b.currency], b.currency)}
            {remaining != null ? (
              remaining > 0 ? (
                <span className="font-medium text-red-600"> · falta {formatMoney(remaining, b.currency)}</span>
              ) : (
                <span className="font-medium text-emerald-600"> · pagada</span>
              )
            ) : null}
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
                </div>
                <span className="shrink-0 font-medium text-emerald-600">{formatMoney(p.amount, p.currency)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-foreground/50">Todavía no hay cobros registrados.</p>
        )}
        <ThirdPartyPaymentForm bookingId={bookingId} paymentMethods={paymentMethods} defaultCurrency={b.currency} />
      </section>
    </div>
  );
}
