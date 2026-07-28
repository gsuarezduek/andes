import { SectionTitle } from "@/components/ui/section-title";
import { Croquis } from "@/components/inspection/croquis";
import { AddDamageForm } from "@/app/(app)/vehicles/[id]/add-damage-form";
import { DamageRow } from "@/components/vehicle/damage-row";
import type { VehicleDetail } from "@/lib/vehicle-detail-queries";

export function ActiveDamagesSection({
  vehicleId,
  isAdmin,
  activeDamages,
}: {
  vehicleId: string;
  isAdmin: boolean;
  activeDamages: VehicleDetail["damages"];
}) {
  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>Daños activos ({activeDamages.length})</SectionTitle>
      {activeDamages.length === 0 ? (
        <p className="rounded-lg border border-foreground/10 px-4 py-3 text-sm text-foreground/50">Sin daños activos.</p>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="mx-auto w-full max-w-[180px] shrink-0">
            <Croquis existing={activeDamages} markers={[]} readOnly />
          </div>
          <ul className="flex-1 divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
            {activeDamages.map((d) => (
              <DamageRow key={d.id} vehicleId={vehicleId} damage={d} isAdmin={isAdmin} />
            ))}
          </ul>
        </div>
      )}
      <details className="rounded-xl border border-foreground/10">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground/70">
          Agregar daño
        </summary>
        <div className="px-4 pb-4">
          <AddDamageForm vehicleId={vehicleId} existing={activeDamages} />
        </div>
      </details>
    </section>
  );
}
