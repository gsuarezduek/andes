import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth-helpers";
import { hasAdminAccess, hasFinanceAccess } from "@/lib/user-permissions";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { SectionTitle } from "@/components/ui/section-title";
import { KmChart } from "@/components/vehicle/km-chart";
import { TeamNotesSection } from "@/components/team-notes-section";
import { addVehicleNote, resolveVehicleNote } from "./notes-actions";
import { VehicleInfo } from "@/components/vehicle/vehicle-info";
import { VehicleActionsBar } from "@/components/vehicle/vehicle-actions-bar";
import { VehicleDetailTabs } from "@/components/vehicle/vehicle-detail-tabs";
import { ActiveDamagesSection } from "@/components/vehicle/active-damages-section";
import { DamageHistorySection } from "@/components/vehicle/damage-history-section";
import { RentalHistorySection } from "@/components/vehicle/rental-history-section";
import { InspectionHistorySection } from "@/components/vehicle/inspection-history-section";
import { MaintenanceSection } from "@/components/vehicle/maintenance-section";
import { vehicleStatusLabels } from "@/lib/labels";
import { vehicleStatusTone, vehicleDisplayName } from "@/lib/vehicle-ui";
import { getVehicleDetail } from "@/lib/vehicle-detail-queries";
import { OwnerContractsSection } from "@/components/owner-contract/owner-contracts-section";
import { SavedBanner } from "@/components/ui/saved-banner";
import { ButtonLink } from "@/components/ui/button";
import { currentOwnerContract } from "@/lib/owner-contract";

export const metadata: Metadata = { title: "Vehículo — Andes" };

export default async function VehicleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; signed?: string }>;
}) {
  const { id } = await params;
  const { tab, signed } = await searchParams;
  const user = await requireUser();
  const isAdmin = hasAdminAccess(user.role);

  const vehicle = await getVehicleDetail(id);
  if (!vehicle) notFound();

  const canSeeFinanceOnly = hasFinanceAccess(user.role, user.owner);
  // El costo de un mantenimiento queda como deuda del proveedor/asociado
  // (cuenta corriente de Caja), nunca como egreso de una cuenta propia.
  const debtAccounts = await prisma.paymentMethod.findMany({
    where: {
      active: true,
      ownership: { in: ["provider", "associate"] },
      ...(canSeeFinanceOnly ? {} : { financeOnly: false }),
    },
    orderBy: { ordering: "asc" },
    select: { id: true, name: true, requiresNote: true, ownership: true, parentId: true },
  });

  const activeDamages = vehicle.damages.filter((d) => !d.repaired);
  const activeNotes = vehicle.teamNotes.filter((n) => !n.resolvedAt);
  const resolvedNotes = vehicle.teamNotes.filter((n) => n.resolvedAt);

  // Orden y eje X por la fecha real del evento (retiro/devolución de la
  // reserva), no por `createdAt` (cuándo se cargó la inspección en Andes) —
  // los alquileres viejos cargados tarde y fuera de orden quedaban con el km
  // "bajando" en el gráfico porque createdAt no refleja la fecha real.
  const kmData = vehicle.inspections
    .map((i) => ({
      id: i.id,
      km: i.km,
      date: i.type === "handover" ? i.rental.startAt : i.rental.endAt,
      type: i.type,
      clientName: i.rental.clientName,
      userName: i.userName,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const hasActiveRental = vehicle.status === "rented" || vehicle.rentals.some((r) => r.status === "active");

  const isThirdParty = vehicle.ownership === "third_party";
  // Server component: se evalúa una vez por request, leer el reloj acá es correcto.
  // eslint-disable-next-line react-hooks/purity
  const now = new Date(Date.now());
  const hasCurrentContract = currentOwnerContract(vehicle.ownerContracts, now) != null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {vehicleDisplayName(vehicle)}
            </h1>
            <p className="text-sm text-foreground/60">
              {vehicle.name ? `${vehicle.brand} ${vehicle.model} · ${vehicle.plate}` : vehicle.plate}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge tone={vehicleStatusTone[vehicle.status]}>{vehicleStatusLabels[vehicle.status]}</Badge>
            {vehicle.ownership === "third_party" && <Badge tone="blue">Tercero</Badge>}
            {vehicle.archivedAt && <Badge tone="neutral">Archivado</Badge>}
          </div>
        </div>

        {/* Editar/QR/Volver/Archivar: a la altura del título, no después de
            todo el bloque de info general (donde quedaban perdidos a mitad
            de pantalla). */}
        <VehicleActionsBar
          vehicleId={vehicle.id}
          isAdmin={isAdmin}
          archived={vehicle.archivedAt != null}
          hasActiveRental={hasActiveRental}
          backHref={vehicle.ownership === "third_party" ? "/third-party-vehicles" : "/vehicles"}
        />

        {/* Notas del equipo: mensajes internos entre compañeros sobre alguna
            situación a tener en cuenta. Mientras no se resuelven, alertan en
            el Calendario sobre la patente de este auto. */}
        <TeamNotesSection
          activeNotes={activeNotes}
          resolvedNotes={resolvedNotes}
          addNote={addVehicleNote.bind(null, vehicle.id)}
          resolveNote={(noteId) => resolveVehicleNote.bind(null, vehicle.id, noteId)}
          placeholder="Ej: quedó con poca nafta, avisar al próximo turno…"
        />
      </div>

      <SavedBanner show={signed === "1"} label="Contrato firmado." />

      {/* El auto se puede alquilar igual: es un aviso, no un bloqueo. */}
      {isThirdParty && !hasCurrentContract && !vehicle.archivedAt && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3">
          <p className="text-sm text-amber-700 dark:text-amber-400">Este auto no tiene un contrato de cesión vigente con su titular.</p>
          <ButtonLink href={`/vehicles/${vehicle.id}/owner-contract/new`} variant="secondary">Crear contrato</ButtonLink>
        </div>
      )}

      {/* El resto (info general, daños, alquileres, mantenimiento) crecía
          indefinido en un solo scroll — partido en pestañas, mismo patrón que
          el detalle de la reserva (RentalDetailTabs). */}
      <VehicleDetailTabs
        general={
          <div className="flex flex-col gap-6">
            <section className="flex flex-col gap-2">
              <SectionTitle>Evolución del kilometraje</SectionTitle>
              <KmChart data={kmData} />
            </section>
            <VehicleInfo vehicle={vehicle} />
          </div>
        }
        danos={
          <div className="flex flex-col gap-6">
            <ActiveDamagesSection vehicleId={vehicle.id} isAdmin={isAdmin} activeDamages={activeDamages} />
            <DamageHistorySection damages={vehicle.damages} />
          </div>
        }
        alquileres={
          <div className="flex flex-col gap-6">
            <RentalHistorySection rentals={vehicle.rentals} />
            <InspectionHistorySection inspections={vehicle.inspections} />
          </div>
        }
        mantenimiento={
          <MaintenanceSection
            vehicleId={vehicle.id}
            isAdmin={isAdmin}
            currentKm={vehicle.currentKm}
            logs={vehicle.maintenanceLogs}
            debtAccounts={debtAccounts}
          />
        }
        contrato={
          isThirdParty ? (
            <OwnerContractsSection vehicleId={vehicle.id} isAdmin={isAdmin} contracts={vehicle.ownerContracts} now={now} />
          ) : undefined
        }
        openContract={tab === "contrato"}
      />
    </div>
  );
}
