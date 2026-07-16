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
  documentKindLabels,
} from "@/lib/labels";
import { rentalStatusTone } from "@/lib/rental-ui";
import { formatDateTime, formatDateInput, formatDateTimeInput } from "@/lib/datetime";
import { SubmitButton } from "@/components/ui/submit-button";
import { EditDetailsForm } from "./edit-details-form";
import { EditReturnForm } from "./edit-return-form";
import { markVehicleService } from "./service-actions";

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
      documents: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!rental) notFound();

  const handover = rental.inspections.find((i) => i.type === "handover");
  const returnInsp = rental.inspections.find((i) => i.type === "return_");
  const canStartHandover = rental.status === "reserved" && !handover;
  const canStartReturn = rental.status === "active" && Boolean(handover) && !returnInsp;
  // Antes de la entrega se pueden editar contacto y vehículo aquí mismo.
  const editableVehicles = canStartHandover
    ? await prisma.vehicle.findMany({
        where: { archivedAt: null },
        orderBy: [{ brand: "asc" }, { model: "asc" }],
        select: { id: true, plate: true, brand: true, model: true },
      })
    : [];
  // Requerimos un vehículo asignado para iniciar la entrega (el wizard ya no lo pide).
  const canStartHandoverNow = canStartHandover && Boolean(rental.vehicleId);
  // Marcar service/arreglo en vez de entregar: para alquileres cargados solo
  // para bloquear el auto (reservado, con unidad, sin entrega hecha).
  const canMarkService = canStartHandover && Boolean(rental.vehicleId);
  const today = formatDateInput(new Date());
  // Extensión: modificar fecha/lugar de devolución mientras no esté cerrado.
  const canEditReturn = rental.status === "reserved" || rental.status === "active";

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
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge tone={rentalStatusTone[rental.status]}>
            {rentalStatusLabels[rental.status]}
          </Badge>
          {!rental.bookingConfirmed && <Badge tone="orange">Sin confirmar</Badge>}
        </div>
      </div>

      {!rental.bookingConfirmed && (
        <p className="rounded-lg bg-orange-500/10 px-4 py-2 text-xs font-medium text-orange-700 dark:text-orange-400">
          Reserva sin confirmar en VikRentCar. Verificá con el cliente antes de entregar.
        </p>
      )}

      {/* Info de la reserva (custdata): lo primero, arriba de datos del cliente. */}
      {rental.bookingNote && (
        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4">
          <p className="text-xs font-medium text-foreground/70">Info de la reserva (VikRentCar)</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/80">{rental.bookingNote}</p>
        </div>
      )}

      {canStartHandover ? (
        <EditDetailsForm
          rentalId={rental.id}
          clientName={rental.clientName}
          clientEmail={rental.clientEmail ?? ""}
          clientPhone={rental.clientPhone ?? ""}
          clientDocNumber={rental.clientDocNumber ?? ""}
          vehicleId={rental.vehicleId ?? ""}
          vehicles={editableVehicles.map((v) => ({
            id: v.id,
            label: `${v.plate} · ${v.brand} ${v.model}`,
          }))}
        />
      ) : (
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
        </div>
      )}

      <div className="divide-y divide-foreground/10 rounded-xl border border-foreground/10 px-4">
        <Row label="Retiro" value={formatDateTime(rental.startAt)} />
        {rental.bookingPickupPlace && (
          <Row label="Lugar de retiro" value={rental.bookingPickupPlace} />
        )}
        <Row label="Devolución" value={formatDateTime(rental.endAt)} />
        {rental.bookingReturnPlace && (
          <Row label="Lugar de devolución" value={rental.bookingReturnPlace} />
        )}
        <Row label="Idioma" value={languageLabels[rental.language]} />
        <Row label="Método de pago" value={rental.bookingPaymentMethod} />
      </div>

      {canEditReturn && (
        <EditReturnForm
          rentalId={rental.id}
          endAt={formatDateTimeInput(rental.endAt)}
          returnPlace={rental.bookingReturnPlace ?? ""}
        />
      )}

      {/* Documentos del cliente (solo interno: no van al acta ni al email) */}
      {rental.documents.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-foreground/70">Documentos del cliente</h2>
          <div className="grid grid-cols-3 gap-2">
            {rental.documents.map((doc) => (
              <a
                key={doc.id}
                href={`/api/media?key=${encodeURIComponent(doc.url)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col gap-1"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/media?key=${encodeURIComponent(doc.url)}`}
                  alt={documentKindLabels[doc.kind]}
                  className="aspect-square w-full rounded-lg border border-foreground/10 object-cover"
                />
                <span className="text-center text-[11px] text-foreground/60">{documentKindLabels[doc.kind]}</span>
              </a>
            ))}
          </div>
          <p className="text-xs text-foreground/40">Respaldo interno. No se incluyen en el acta ni en los emails.</p>
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

      {canStartHandover && !canStartHandoverNow && (
        <p className="rounded-lg bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-700 dark:text-amber-400">
          Asigná un vehículo arriba para poder iniciar la entrega.
        </p>
      )}

      {/* Service / arreglo: para autos cargados como alquiler solo para
          bloquearlos. Registra el arreglo y deja el auto fuera de servicio. */}
      {canMarkService && (
        <details className="rounded-xl border border-foreground/10">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground/70">
            ¿El auto va a service o arreglo? (no hacer entrega)
          </summary>
          <form
            action={markVehicleService.bind(null, rental.id, rental.vehicleId!)}
            className="flex flex-col gap-3 border-t border-foreground/10 p-4"
          >
            <p className="text-xs text-foreground/50">
              Registra el service/arreglo y deja el auto <strong>fuera de servicio</strong>. Este
              alquiler queda cancelado. Cuando vuelva, reactivá el auto desde su ficha.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-foreground/70">Tipo</span>
                <select name="type" defaultValue="repair" className="h-10 rounded-lg border border-foreground/15 bg-transparent px-2 text-sm">
                  <option value="service">Service</option>
                  <option value="repair">Arreglo</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-foreground/70">Fecha</span>
                <input type="date" name="date" required defaultValue={today} className="h-10 rounded-lg border border-foreground/15 bg-transparent px-2 text-sm" />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-foreground/70">Km</span>
                <input type="number" name="km" inputMode="numeric" defaultValue={rental.vehicle?.currentKm ?? ""} className="h-10 rounded-lg border border-foreground/15 bg-transparent px-2 text-sm" />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-foreground/70">Costo</span>
                <input type="number" name="cost" inputMode="numeric" className="h-10 rounded-lg border border-foreground/15 bg-transparent px-2 text-sm" />
              </label>
            </div>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-foreground/70">Lugar / taller</span>
              <input name="place" placeholder="Ej. taller del centro" className="h-10 rounded-lg border border-foreground/15 bg-transparent px-3 text-sm" />
            </label>
            <input name="description" required placeholder="Qué arreglo/service (ej. cambio de correa)" className="h-10 rounded-lg border border-foreground/15 bg-transparent px-3 text-sm" />
            <SubmitButton pendingLabel="Guardando…">Marcar fuera de servicio</SubmitButton>
          </form>
        </details>
      )}

      <div className="flex gap-3">
        {canStartHandoverNow && (
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
          className={canStartHandoverNow || canStartReturn ? "" : "flex-1"}
        >
          Volver
        </ButtonLink>
      </div>
    </div>
  );
}
