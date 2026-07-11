import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import {
  rentalStatusLabels,
  rentalOriginLabels,
  languageLabels,
} from "@/lib/labels";
import { rentalStatusTone } from "@/lib/rental-ui";
import { formatDateTime } from "@/lib/datetime";

export const metadata: Metadata = { title: "Alquiler — Andes" };

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <span className="text-foreground/60">{label}</span>
      <span className="text-right font-medium">{value ?? "—"}</span>
    </div>
  );
}

export default async function RentalDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ entrega?: string; devolucion?: string }>;
}) {
  const { id } = await params;
  const { entrega, devolucion } = await searchParams;
  await requireUser();

  const rental = await prisma.rental.findUnique({
    where: { id },
    include: {
      vehicle: true,
      inspections: {
        orderBy: { createdAt: "asc" },
        include: { user: { select: { name: true } } },
      },
    },
  });
  if (!rental) notFound();

  const handover = rental.inspections.find((i) => i.type === "handover");
  const returnInsp = rental.inspections.find((i) => i.type === "return_");
  const canStartHandover = rental.status === "reserved" && !handover;
  const canStartReturn = rental.status === "active" && Boolean(handover) && !returnInsp;

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      {entrega === "ok" && (
        <p className="rounded-lg bg-green-500/10 px-4 py-3 text-sm font-medium text-green-700 dark:text-green-400">
          Entrega registrada. El acta y los emails se están generando.
        </p>
      )}
      {devolucion === "ok" && (
        <p className="rounded-lg bg-green-500/10 px-4 py-3 text-sm font-medium text-green-700 dark:text-green-400">
          Devolución registrada. El alquiler quedó finalizado; el acta y los emails se están generando.
        </p>
      )}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{rental.clientName}</h1>
          <p className="text-sm text-foreground/60">
            {rentalOriginLabels[rental.origin]}
            {rental.wpBookingId ? ` · orden #${rental.wpBookingId}` : ""}
          </p>
        </div>
        <Badge tone={rentalStatusTone[rental.status]}>
          {rentalStatusLabels[rental.status]}
        </Badge>
      </div>

      <div className="divide-y divide-foreground/10 rounded-xl border border-foreground/10 px-4">
        <Row label="Email" value={rental.clientEmail} />
        <Row label="Teléfono" value={rental.clientPhone} />
        <Row label="Documento" value={rental.clientDocNumber} />
        <Row
          label="Vehículo"
          value={
            rental.vehicle ? (
              <Link className="underline" href={`/vehicles/${rental.vehicle.id}`}>
                {rental.vehicle.brand} {rental.vehicle.model} · {rental.vehicle.plate}
              </Link>
            ) : rental.bookingModel ? (
              <span>
                {rental.bookingModel}
                <span className="font-normal text-foreground/50"> · sin unidad asignada</span>
              </span>
            ) : (
              "Sin asignar"
            )
          }
        />
        <Row label="Retiro" value={formatDateTime(rental.startAt)} />
        {rental.bookingPickupPlace && (
          <Row label="Lugar de retiro" value={rental.bookingPickupPlace} />
        )}
        <Row label="Devolución" value={formatDateTime(rental.endAt)} />
        {rental.bookingReturnPlace && (
          <Row label="Lugar de devolución" value={rental.bookingReturnPlace} />
        )}
        <Row label="Idioma" value={languageLabels[rental.language]} />
      </div>

      {rental.bookingNote && (
        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4">
          <p className="text-xs font-medium text-foreground/70">Info de la reserva (VikRentCar)</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/80">{rental.bookingNote}</p>
        </div>
      )}

      {/* Inspecciones registradas */}
      {rental.inspections.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-foreground/70">Actas</h2>
          <ul className="flex flex-col divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
            {rental.inspections.map((insp) => (
              <li key={insp.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">
                    {insp.type === "handover" ? "Entrega" : "Devolución"}
                  </p>
                  <p className="text-xs text-foreground/50">
                    {formatDateTime(insp.createdAt)} · Responsable:{" "}
                    {insp.user?.name ?? "—"}
                  </p>
                </div>
                <a
                  className="shrink-0 font-medium underline"
                  href={`/api/acta?inspectionId=${insp.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Ver acta PDF
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-3">
        {canStartHandover && (
          <ButtonLink href={`/rentals/${rental.id}/handover`} className="flex-1">
            Iniciar entrega
          </ButtonLink>
        )}
        {canStartReturn && (
          <ButtonLink href={`/rentals/${rental.id}/return`} className="flex-1">
            Iniciar devolución
          </ButtonLink>
        )}
        <ButtonLink
          href="/rentals"
          variant="secondary"
          className={canStartHandover || canStartReturn ? "" : "flex-1"}
        >
          Volver
        </ButtonLink>
      </div>
    </div>
  );
}
