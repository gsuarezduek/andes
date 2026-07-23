import { SectionTitle } from "@/components/ui/section-title";
import { Croquis } from "@/components/inspection/croquis";
import { AddDamageForm } from "@/app/(app)/vehicles/[id]/add-damage-form";
import { markDamageRepaired, deleteDamage } from "@/app/(app)/vehicles/[id]/damage-actions";
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
              <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div className="flex min-w-0 items-center gap-3">
                  {d.photoUrl && (
                    <a
                      href={`/api/media?key=${encodeURIComponent(d.photoUrl)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/media?key=${encodeURIComponent(d.photoUrl)}`}
                        alt={d.description || "Foto del daño"}
                        className="h-12 w-12 rounded-lg border border-foreground/10 object-cover"
                      />
                    </a>
                  )}
                  <span className="min-w-0">{d.description || "Daño sin descripción"}</span>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <form action={markDamageRepaired.bind(null, vehicleId, d.id)}>
                    <button className="text-xs font-medium text-emerald-600">Marcar reparado</button>
                  </form>
                  {isAdmin && (
                    <form action={deleteDamage.bind(null, vehicleId, d.id)}>
                      <button className="text-xs text-red-600">Borrar</button>
                    </form>
                  )}
                </div>
              </li>
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
