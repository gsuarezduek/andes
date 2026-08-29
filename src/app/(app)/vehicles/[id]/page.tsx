import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth-helpers";
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
import { formatDate } from "@/lib/datetime";
import { getVehicleDetail } from "@/lib/vehicle-detail-queries";

export const metadata: Metadata = { title: "Vehículo — Andes" };

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const isAdmin = user.role === "admin";

  const vehicle = await getVehicleDetail(id);
  if (!vehicle) notFound();

  const paymentMethods = await prisma.paymentMethod.findMany({
    where: { active: true },
    orderBy: { ordering: "asc" },
    select: { id: true, name: true, requiresNote: true },
  });

  const activeDamages = vehicle.damages.filter((d) => !d.repaired);
  const activeNotes = vehicle.teamNotes.filter((n) => !n.resolvedAt);
  const resolvedNotes = vehicle.teamNotes.filter((n) => n.resolvedAt);

  const kmData = vehicle.inspections.map((i) => ({ km: i.km, label: formatDate(i.createdAt) }));
  const hasActiveRental = vehicle.status === "rented" || vehicle.rentals.some((r) => r.status === "active");

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
            paymentMethods={paymentMethods}
          />
        }
      />
    </div>
  );
}
