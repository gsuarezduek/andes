import { SectionTitle } from "@/components/ui/section-title";
import { MaintenanceForm } from "@/components/vehicle/maintenance-form";
import { MaintenanceRow } from "@/components/vehicle/maintenance-row";
import { formatArs } from "@/lib/contract";
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
            <MaintenanceRow
              key={m.id}
              vehicleId={vehicleId}
              isAdmin={isAdmin}
              log={{
                id: m.id,
                type: m.type,
                date: m.date,
                km: m.km,
                costLabel: m.cost != null ? formatArs(Number(m.cost)) : null,
                place: m.place,
                description: m.description,
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}
