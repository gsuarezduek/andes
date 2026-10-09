import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth-helpers";
import { getThirdPartyVehicleDetail, type ThirdPartyVehicleBookingView } from "@/lib/third-party-vehicles/queries";
import { formatDateTime } from "@/lib/datetime";
import { formatMoney } from "@/lib/contract";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { FleetTabs } from "@/components/rooms/fleet-tabs";
import { ThirdPartyBookingForm } from "@/components/third-party-vehicles/booking-form";
import { createThirdPartyVehicleBooking, setThirdPartyVehicleArchived } from "../actions";

export const metadata: Metadata = { title: "Vehículo de tercero — Andes" };

function BookingRow({ vehicleId, b }: { vehicleId: string; b: ThirdPartyVehicleBookingView }) {
  return (
    <li>
      <Link
        href={`/third-party-vehicles/${vehicleId}/bookings/${b.id}`}
        className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-foreground/[0.03] ${b.status === "cancelled" ? "opacity-60" : ""}`}
      >
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            <span className="truncate">{b.clientName}</span>
            {b.status === "cancelled" ? <Badge tone="red">Cancelada</Badge> : null}
          </p>
          <p className="text-sm text-foreground/60">
            {formatDateTime(b.startAt)} → {formatDateTime(b.endAt)}
            {b.totalAmount > 0 ? ` · ${formatMoney(b.totalAmount, b.currency)}` : ""}
          </p>
        </div>
      </Link>
    </li>
  );
}

export default async function ThirdPartyVehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const detail = await getThirdPartyVehicleDetail(id);
  if (!detail) notFound();
  const { vehicle, bookings } = detail;

  const now = new Date();
  const upcoming = bookings.filter((b) => b.status === "confirmed" && b.endAt >= now).sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  const past = bookings.filter((b) => !(b.status === "confirmed" && b.endAt >= now));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <div className="flex flex-col gap-4">
        <FleetTabs active="thirdParty" />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight">
              {vehicle.plate} · {vehicle.brand} {vehicle.model}
              {vehicle.archived ? <Badge tone="neutral">Archivado</Badge> : null}
            </h1>
            <p className="text-sm text-foreground/60">
              {vehicle.year ? `${vehicle.year} · ` : ""}
              {vehicle.color ? `${vehicle.color} · ` : ""}
              Titular: {vehicle.ownerName}
              {vehicle.ownerPhone ? ` · ${vehicle.ownerPhone}` : ""}
            </p>
            {vehicle.notes ? <p className="mt-1 whitespace-pre-wrap text-xs text-foreground/50">{vehicle.notes}</p> : null}
          </div>
          {isAdmin ? (
            <div className="flex gap-2">
              <ButtonLink href={`/third-party-vehicles/${id}/edit`} variant="secondary">
                Editar
              </ButtonLink>
              <form action={setThirdPartyVehicleArchived.bind(null, id, !vehicle.archived)}>
                <Button type="submit" variant="secondary">
                  {vehicle.archived ? "Reactivar" : "Archivar"}
                </Button>
              </form>
            </div>
          ) : null}
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <SectionHeading>
          {upcoming.length} reserva{upcoming.length === 1 ? "" : "s"} próxima{upcoming.length === 1 ? "" : "s"} o en curso
        </SectionHeading>
        {upcoming.length > 0 ? (
          <ul className="divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
            {upcoming.map((b) => (
              <BookingRow key={b.id} vehicleId={id} b={b} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-foreground/50">No hay reservas próximas.</p>
        )}
        {past.length > 0 ? (
          <details className="rounded-xl border border-foreground/10">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Pasadas y canceladas ({past.length})</summary>
            <ul className="divide-y divide-foreground/10 border-t border-foreground/10">
              {past.map((b) => (
                <BookingRow key={b.id} vehicleId={id} b={b} />
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      {vehicle.archived ? null : (
        <section className="flex flex-col gap-3">
          <SectionHeading description="El tercero maneja su propio papeleo — acá solo queda registrada la ocupación.">
            Nueva reserva
          </SectionHeading>
          <div className="rounded-xl border border-foreground/10 p-4">
            <ThirdPartyBookingForm action={createThirdPartyVehicleBooking.bind(null, id)} submitLabel="Crear reserva" />
          </div>
        </section>
      )}
    </div>
  );
}
