import { Badge } from "@/components/ui/badge";
import { SectionTitle } from "@/components/ui/section-title";
import { maintenanceTypeLabels } from "@/lib/labels";
import { formatArs } from "@/lib/contract";
import { formatDate } from "@/lib/datetime";
import { MaintenanceForm } from "@/components/vehicle/maintenance-form";
import { deleteMaintenance } from "@/app/(app)/vehicles/[id]/maintenance-actions";
import type { VehicleDetail } from "@/lib/vehicle-detail-queries";

type PaymentMethodOption = { id: string; name: string; requiresNote: boolean };

export function MaintenanceSection({
  vehicleId,
  isAdmin,
  currentKm,
  logs,
  paymentMethods,
}: {
  vehicleId: string;
  isAdmin: boolean;
  currentKm: number;
  logs: VehicleDetail["maintenanceLogs"];
  paymentMethods: PaymentMethodOption[];
}) {
  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>Mantenimiento</SectionTitle>

      <MaintenanceForm vehicleId={vehicleId} currentKm={currentKm} paymentMethods={paymentMethods} />

      {logs.length === 0 ? (
        <p className="rounded-lg border border-foreground/10 px-4 py-3 text-sm text-foreground/50">Sin registros de mantenimiento.</p>
      ) : (
        <div className="divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
          {logs.map((m) => (
            <div key={m.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Badge tone="neutral">{maintenanceTypeLabels[m.type]}</Badge>
                  <span className="text-xs text-foreground/50">{formatDate(m.date)}{m.km != null ? ` · ${m.km.toLocaleString("es-AR")} km` : ""}</span>
                </div>
                <p className="mt-1">{m.description}</p>
                {m.place && <p className="text-xs text-foreground/50">📍 {m.place}</p>}
              </div>
              <div className="flex flex-col items-end gap-1">
                {m.cost != null && <span className="font-medium">{formatArs(Number(m.cost))}</span>}
                {isAdmin && (
                  <form action={deleteMaintenance.bind(null, vehicleId, m.id)}>
                    <button className="text-xs text-red-600">Borrar</button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
