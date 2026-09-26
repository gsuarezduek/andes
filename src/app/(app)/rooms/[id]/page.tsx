import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth-helpers";
import { getRoomDetail, bookingGuestLabel, type RoomBookingView } from "@/lib/rooms/queries";
import { nightsBetween } from "@/lib/rooms/dates";
import { roomSourceLabels } from "@/lib/rooms/feed-url";
import { formatDateInput } from "@/lib/datetime";
import { formatArs, formatMoney } from "@/lib/contract";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { SubmitButton } from "@/components/ui/submit-button";
import { FleetTabs } from "@/components/rooms/fleet-tabs";
import { FeedManager } from "@/components/rooms/feed-manager";
import { BookingForm } from "@/components/rooms/booking-form";
import { createManualBooking, setRoomArchived, syncRoomNow } from "../actions";

export const metadata: Metadata = { title: "Habitación — Andes" };

/** "2026-09-30" → "30/09/2026". */
const fmt = (k: string) => `${k.slice(8, 10)}/${k.slice(5, 7)}/${k.slice(0, 4)}`;

function BookingRow({ roomId, b }: { roomId: string; b: RoomBookingView }) {
  const nights = nightsBetween(b.startDate, b.endDate);
  return (
    <li>
      <Link
        href={`/rooms/${roomId}/bookings/${b.id}`}
        className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-foreground/[0.03] ${b.mirrored || b.status === "cancelled" ? "opacity-60" : ""}`}
      >
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-medium">
            <span className="truncate">{bookingGuestLabel(b)}</span>
            <Badge tone={b.source === "airbnb" ? "red" : b.source === "booking" ? "blue" : "neutral"}>{roomSourceLabels[b.source]}</Badge>
            {b.isBlock ? <Badge tone="amber">Bloqueo</Badge> : null}
            {b.status === "cancelled" ? <Badge tone="red">Cancelada</Badge> : null}
            {b.mirrored ? <Badge tone="neutral">Misma estadía de otro canal</Badge> : null}
          </p>
          <p className="text-sm text-foreground/60">
            {fmt(b.startDate)} → {fmt(b.endDate)} · {nights} noche{nights === 1 ? "" : "s"}
            {b.totalAmount > 0 ? ` · ${formatMoney(b.totalAmount, b.currency)}` : ""}
          </p>
        </div>
      </Link>
    </li>
  );
}

export default async function RoomDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const isAdmin = user.role === "admin";
  const detail = await getRoomDetail(id);
  if (!detail) notFound();
  const { room, feeds, bookings } = detail;

  const todayKey = formatDateInput(new Date());
  const upcoming = bookings
    .filter((b) => b.status === "confirmed" && b.endDate >= todayKey)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const past = bookings.filter((b) => !(b.status === "confirmed" && b.endDate >= todayKey));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <div className="flex flex-col gap-4">
        <FleetTabs active="rooms" />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold tracking-tight">
              {room.name}
              {room.archived ? <Badge tone="neutral">Archivada</Badge> : null}
            </h1>
            <p className="text-sm text-foreground/60">
              {room.nightlyRate != null ? `${formatArs(room.nightlyRate)}/noche` : "Sin tarifa"}
              {room.capacity ? ` · ${room.capacity} pers.` : ""} · entrada {room.checkInTime} · salida {room.checkOutTime}
            </p>
            {room.description ? <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/70">{room.description}</p> : null}
            {room.notes ? <p className="mt-1 whitespace-pre-wrap text-xs text-foreground/50">{room.notes}</p> : null}
          </div>
          {isAdmin ? (
            <div className="flex gap-2">
              <ButtonLink href={`/rooms/${id}/edit`} variant="secondary">
                Editar
              </ButtonLink>
              <form action={setRoomArchived.bind(null, id, !room.archived)}>
                <Button type="submit" variant="secondary">
                  {room.archived ? "Reactivar" : "Archivar"}
                </Button>
              </form>
            </div>
          ) : null}
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <SectionHeading description="Se leen solos cada pocos minutos (solo lectura).">Calendarios de Airbnb / Booking</SectionHeading>
          {feeds.length > 0 ? (
            <form action={syncRoomNow.bind(null, id)}>
              <SubmitButton variant="secondary" pendingLabel="Sincronizando…">
                Sincronizar ahora
              </SubmitButton>
            </form>
          ) : null}
        </div>
        <FeedManager roomId={id} feeds={feeds} isAdmin={isAdmin} />
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeading>{upcoming.length} reserva{upcoming.length === 1 ? "" : "s"} próxima{upcoming.length === 1 ? "" : "s"} o en curso</SectionHeading>
        {upcoming.length > 0 ? (
          <ul className="divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
            {upcoming.map((b) => (
              <BookingRow key={b.id} roomId={id} b={b} />
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
                <BookingRow key={b.id} roomId={id} b={b} />
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      {room.archived ? null : (
        <section className="flex flex-col gap-3">
          <SectionHeading description="Para una reserva directa, o algo que no llega por iCal. Las de Airbnb/Booking entran solas.">
            Nueva reserva manual
          </SectionHeading>
          <div className="rounded-xl border border-foreground/10 p-4">
            <BookingForm action={createManualBooking.bind(null, id)} submitLabel="Crear reserva" suggestedRate={room.nightlyRate} />
          </div>
        </section>
      )}
    </div>
  );
}
