import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { SectionTitle } from "@/components/ui/section-title";
import { rentalOriginLabels } from "@/lib/labels";
import { rentalStatusDisplay } from "@/lib/rental-ui";
import { formatArs } from "@/lib/contract";
import { env } from "@/lib/env";
import { vikrentcarOrderUrl } from "@/lib/vikrentcar";
import { ExternalLinkIcon } from "@/components/ui/icons";
import { StatusBanners } from "@/components/rentals/status-banners";
import { RentalDetailTabs } from "@/components/rentals/rental-detail-tabs";
import { TeamNotesSection } from "@/components/team-notes-section";
import { addRentalNote, resolveRentalNote } from "./notes-actions";
import { ClientInfoSection } from "@/components/rentals/client-info-section";
import { DateInfoSection } from "@/components/rentals/date-info-section";
import { PaymentsSection } from "@/components/rentals/payments-section";
import { PaymentHistorySection } from "@/components/rentals/payment-history-section";
import { AddPaymentButton } from "@/components/rentals/add-payment-button";
import { AddServiceButton } from "@/components/rentals/add-service-button";
import { ReturnEditSection } from "@/components/rentals/return-edit-section";
import { DocumentsSection } from "@/components/rentals/documents-section";
import { InspectionsSection } from "@/components/rentals/inspections-section";
import { DangerZoneSection } from "@/components/rentals/danger-zone-section";
import { MergeDuplicateSection } from "@/components/rentals/merge-duplicate-section";
import { getRentalDetail, getEditableVehicles, getMergeCandidates } from "@/lib/rental-detail-queries";
import { computeRentalFlags } from "@/lib/rental-flags";
import { computeRentalPayments, paymentAccent } from "@/lib/rental-payments";

export const metadata: Metadata = { title: "Alquiler — Andes" };

/** Placeholder para una pestaña sin contenido — sin esto, la pestaña queda
 *  en blanco y parece rota en vez de simplemente "no hay nada acá todavía". */
function TabEmpty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-foreground/10 px-4 py-3 text-sm text-foreground/50">
      {children}
    </p>
  );
}

export default async function RentalDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ entrega?: string; devolucion?: string; fusion?: string }>;
}) {
  const { id } = await params;
  const { entrega, devolucion, fusion } = await searchParams;
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

  // "¿Es un duplicado?": reserva importada de VikRentCar (tiene wpBookingId),
  // todavía sin entregar y sin inspección → candidata a ser la orden que se
  // cargó solo para bloquear el auto, mientras el alquiler real ya se
  // entregó con otra carga en Andes. Solo admin.
  const canMergeDuplicate =
    isAdmin && rental.status === "reserved" && rental.wpBookingId != null && rental.inspections.length === 0;
  const mergeCandidates = canMergeDuplicate ? await getMergeCandidates(rental.id) : [];

  const payments = computeRentalPayments(rental);
  const { hasContract, hasRealPaid, totalRef, paidSoFar, balance, showPayments } = payments;
  const accent = paymentAccent(rental.status, rental.bookingConfirmed, payments);

  // Link directo a la orden en el admin de VikRentCar, solo si la reserva
  // vino sincronizada (wpBookingId) y hay un sitio de WordPress configurado.
  const wpOrderUrl =
    rental.wpBookingId != null && env.wpSiteUrl ? vikrentcarOrderUrl(env.wpSiteUrl, rental.wpBookingId) : null;

  // Pago suelto (botón del header): solo tiene sentido antes de cerrar la reserva.
  const canAddPayment = rental.status === "reserved" || rental.status === "active";
  const rawPaymentMethods = await prisma.paymentMethod.findMany({
    where: { active: true },
    orderBy: { ordering: "asc" },
    select: { id: true, name: true, adjustmentPercent: true, reference: true, requiresNote: true },
  });
  const paymentMethods = rawPaymentMethods.map((m) => ({
    id: m.id,
    name: m.name,
    adjustmentPercent: m.adjustmentPercent ? Number(m.adjustmentPercent) : undefined,
    reference: m.reference ?? undefined,
    requiresNote: m.requiresNote,
  }));

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <StatusBanners entrega={entrega} devolucion={devolucion} fusion={fusion} />

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{rental.clientName}</h1>
          <p className="text-sm text-foreground/60">
            {rentalOriginLabels[rental.origin]}
            {rental.wpBookingId ? ` · orden #${rental.wpBookingId}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {canMarkService && (
            <AddServiceButton
              rentalId={rental.id}
              vehicleId={rental.vehicleId!}
              currentKm={rental.vehicle?.currentKm ?? null}
              paymentMethods={paymentMethods}
            />
          )}
          {canAddPayment && <AddPaymentButton rentalId={rental.id} paymentMethods={paymentMethods} />}
          {wpOrderUrl && (
            <a
              href={wpOrderUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Ver en VikRentCar"
              aria-label="Ver en VikRentCar"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
            >
              <ExternalLinkIcon />
            </a>
          )}
          {(() => {
            const { label, tone } = rentalStatusDisplay(rental.status, rental.bookingConfirmed);
            return (
              <Badge tone={tone} ring={accent}>
                {label}
              </Badge>
            );
          })()}
        </div>
      </div>

      {!rental.bookingConfirmed && (
        <p className="rounded-lg bg-orange-500/10 px-4 py-2 text-xs font-medium text-orange-700 dark:text-orange-400">
          Reserva sin confirmar en VikRentCar. Verificá con el cliente antes de entregar.
        </p>
      )}

      {rental.bookingConfirmed &&
        rental.status === "reserved" &&
        accent !== "pending" &&
        (paidSoFar == null || paidSoFar === 0) && (
          <p className="rounded-lg bg-red-500/10 px-4 py-2 text-xs font-medium text-red-700 dark:text-red-400">
            Reserva confirmada sin seña registrada en Andes. Cargá el pago con el botón de arriba.
          </p>
        )}

      {accent === "pending" && (
        <p className="rounded-lg bg-red-500/10 px-4 py-2 text-xs font-medium text-red-700 dark:text-red-400">
          Falta pagar {formatArs(balance)}.
        </p>
      )}

      {/* Notas del equipo: mensajes internos entre compañeros sobre esta
          reserva. Mientras no se resuelven, alertan en el listado de
          Alquileres y en la barra del Calendario. */}
      <TeamNotesSection
        activeNotes={activeNotes}
        resolvedNotes={resolvedNotes}
        addNote={addRentalNote.bind(null, rental.id)}
        resolveNote={(noteId) => resolveRentalNote.bind(null, rental.id, noteId)}
        placeholder="Ej: el cliente pidió cambiar el horario de entrega…"
      />

      {/* Info de la reserva (custdata): lo primero, arriba de datos del cliente. */}
      {rental.bookingNote && (
        <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4">
          <p className="text-xs font-medium text-foreground/70">Info de la reserva (VikRentCar)</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/80">{rental.bookingNote}</p>
        </div>
      )}

      <RentalDetailTabs
        datos={
          <>
            <ClientInfoSection rental={rental} canStartHandover={canStartHandover} editableVehicles={editableVehicles} />
            <div className="flex flex-col gap-3">
              <SectionTitle>Datos de pago y retiro</SectionTitle>
              <DateInfoSection rental={rental} />
              {showPayments && (
                <PaymentsSection hasContract={hasContract} hasRealPaid={hasRealPaid} totalRef={totalRef} paidSoFar={paidSoFar} balance={balance} />
              )}
            </div>
          </>
        }
        pagos={
          rental.cashMovements.length === 0 ? (
            <TabEmpty>Sin pagos registrados.</TabEmpty>
          ) : (
            <PaymentHistorySection
              movements={rental.cashMovements.map((m) => ({
                id: m.id,
                description: m.description,
                amount: Number(m.amount),
                paymentMethodName: m.paymentMethodName,
                paymentMethodNote: m.paymentMethodNote,
                needsConfirmation: m.needsConfirmation,
                createdByName: m.createdBy?.name ?? null,
                createdAt: m.createdAt,
              }))}
              paymentMethods={paymentMethods}
            />
          )
        }
        documentos={
          /* Documentos del cliente (solo interno: no van al acta ni al email) */
          rental.documents.length === 0 ? (
            <TabEmpty>Sin documentos cargados.</TabEmpty>
          ) : (
            <DocumentsSection documents={rental.documents} />
          )
        }
        inspecciones={
          !canEditReturn && !returnManagedInWp && rental.inspections.length === 0 ? (
            <TabEmpty>Todavía no hay inspecciones registradas.</TabEmpty>
          ) : (
            <>
              <ReturnEditSection rental={rental} canEditReturn={canEditReturn} returnManagedInWp={returnManagedInWp} />
              <InspectionsSection inspections={rental.inspections} />
            </>
          )
        }
      />

      {canStartHandover && !canStartHandoverNow && (
        <p className="rounded-lg bg-amber-500/10 px-4 py-2 text-xs font-medium text-amber-700 dark:text-amber-400">
          Asigná un vehículo arriba para poder iniciar la entrega.
        </p>
      )}

      {/* El botón para iniciar la entrega vive dentro de EditDetailsForm
          ("Guardar e iniciar entrega") para no perder ediciones sin guardar. */}

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

      {/* ¿Es un duplicado? (fusionar con otra reserva) y Eliminar reserva: dos
          acciones admin poco frecuentes, lado a lado en desktop (50% cada
          una); apiladas en mobile porque su contenido expandido (buscador,
          confirmación) no entra cómodo en la mitad de una pantalla chica. */}
      {(canMergeDuplicate || (isAdmin && rental.inspections.length === 0)) && (
        <div className="flex flex-col gap-3 sm:flex-row">
          {/* ¿Es un duplicado? (admin): la reserva que se cargó en VikRentCar
              solo para bloquear el auto, mientras el alquiler real se entregó
              con otra carga en Andes. */}
          {canMergeDuplicate && (
            <div className="sm:flex-1">
              <MergeDuplicateSection duplicateId={rental.id} candidates={mergeCandidates} />
            </div>
          )}

          {/* Eliminar reserva (admin, solo si no tiene entrega/acta). Para
              reservas huérfanas: órdenes borradas en VikRentCar o cargas
              manuales erróneas. */}
          {isAdmin && rental.inspections.length === 0 && (
            <div className="sm:flex-1">
              <DangerZoneSection rentalId={rental.id} clientName={rental.clientName} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
