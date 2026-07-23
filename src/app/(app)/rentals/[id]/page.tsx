import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { rentalOriginLabels } from "@/lib/labels";
import { rentalStatusDisplay } from "@/lib/rental-ui";
import { formatDateInput } from "@/lib/datetime";
import { StatusBanners } from "@/components/rentals/status-banners";
import { TeamNotesSection } from "@/components/rentals/team-notes-section";
import { ClientInfoSection } from "@/components/rentals/client-info-section";
import { DateInfoSection } from "@/components/rentals/date-info-section";
import { PaymentsSection } from "@/components/rentals/payments-section";
import { ReturnEditSection } from "@/components/rentals/return-edit-section";
import { DocumentsSection } from "@/components/rentals/documents-section";
import { InspectionsSection } from "@/components/rentals/inspections-section";
import { ServiceFormSection } from "@/components/rentals/service-form-section";
import { DangerZoneSection } from "@/components/rentals/danger-zone-section";
import { getRentalDetail, getEditableVehicles } from "@/lib/rental-detail-queries";
import { computeRentalFlags } from "@/lib/rental-flags";
import { computeRentalPayments } from "@/lib/rental-payments";

export const metadata: Metadata = { title: "Alquiler — Andes" };

export default async function RentalDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ entrega?: string; devolucion?: string }>;
}) {
  const { id } = await params;
  const { entrega, devolucion } = await searchParams;
  const user = await requireUser();
  const isAdmin = user.role === "admin";

  const rental = await getRentalDetail(id);
  if (!rental) notFound();

  const activeNotes = rental.teamNotes.filter((n) => !n.resolvedAt);
  const resolvedNotes = rental.teamNotes.filter((n) => n.resolvedAt);

  const {
    canStartHandover,
    canStartReturn,
    canStartHandoverNow,
    canMarkService,
    canEditReturn,
    returnManagedInWp,
  } = computeRentalFlags(rental);

  // Antes de la entrega se pueden editar contacto y vehículo aquí mismo.
  const editableVehicles = canStartHandover ? await getEditableVehicles() : [];

  const today = formatDateInput(new Date());

  const { hasContract, totalRef, paidSoFar, balance, showPayments } = computeRentalPayments(rental);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <StatusBanners entrega={entrega} devolucion={devolucion} />

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{rental.clientName}</h1>
          <p className="text-sm text-foreground/60">
            {rentalOriginLabels[rental.origin]}
            {rental.wpBookingId ? ` · orden #${rental.wpBookingId}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {(() => {
            const { label, tone } = rentalStatusDisplay(rental.status, rental.bookingConfirmed);
            return <Badge tone={tone}>{label}</Badge>;
          })()}
        </div>
      </div>

      {!rental.bookingConfirmed && (
        <p className="rounded-lg bg-orange-500/10 px-4 py-2 text-xs font-medium text-orange-700 dark:text-orange-400">
          Reserva sin confirmar en VikRentCar. Verificá con el cliente antes de entregar.
        </p>
      )}

      {/* Notas del equipo: mensajes internos entre compañeros sobre esta
          reserva. Mientras no se resuelven, alertan en el listado de
          Alquileres y en la barra del Calendario. */}
      <TeamNotesSection rentalId={rental.id} activeNotes={activeNotes} resolvedNotes={resolvedNotes} />

      {/* Info de la reserva (custdata): lo primero, arriba de datos del cliente. */}
      {rental.bookingNote && (
        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4">
          <p className="text-xs font-medium text-foreground/70">Info de la reserva (VikRentCar)</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/80">{rental.bookingNote}</p>
        </div>
      )}

      <ClientInfoSection rental={rental} canStartHandover={canStartHandover} editableVehicles={editableVehicles} />

      <DateInfoSection rental={rental} />

      {showPayments && (
        <PaymentsSection hasContract={hasContract} totalRef={totalRef} paidSoFar={paidSoFar} balance={balance} />
      )}

      <ReturnEditSection rental={rental} canEditReturn={canEditReturn} returnManagedInWp={returnManagedInWp} />

      {/* Documentos del cliente (solo interno: no van al acta ni al email) */}
      <DocumentsSection documents={rental.documents} />

      {/* Inspecciones registradas */}
      <InspectionsSection inspections={rental.inspections} />

      {canStartHandover && !canStartHandoverNow && (
        <p className="rounded-lg bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-700 dark:text-amber-400">
          Asigná un vehículo arriba para poder iniciar la entrega.
        </p>
      )}

      {/* El botón para iniciar la entrega vive dentro de EditDetailsForm
          ("Guardar e iniciar entrega") para no perder ediciones sin guardar. */}

      {/* Service / arreglo: para autos cargados como alquiler solo para
          bloquearlos. Registra el arreglo y deja el auto fuera de servicio. */}
      {canMarkService && (
        <ServiceFormSection
          rentalId={rental.id}
          vehicleId={rental.vehicleId!}
          currentKm={rental.vehicle?.currentKm ?? null}
          today={today}
        />
      )}

      <div className="flex gap-3">
        {canStartReturn && (
          <ButtonLink href={`/rentals/${rental.id}/return`} className="flex-1">
            Iniciar devolución
          </ButtonLink>
        )}
        <ButtonLink
          href="/rentals"
          variant="secondary"
          className={canStartReturn ? "" : "flex-1"}
        >
          Volver
        </ButtonLink>
      </div>

      {/* Eliminar reserva (admin, solo si no tiene entrega/acta). Para reservas
          huérfanas: órdenes borradas en VikRentCar o cargas manuales erróneas. */}
      {isAdmin && rental.inspections.length === 0 && <DangerZoneSection rentalId={rental.id} />}
    </div>
  );
}
