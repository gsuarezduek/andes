import { Badge } from "@/components/ui/badge";
import { SectionTitle } from "@/components/ui/section-title";
import { SubmitButton } from "@/components/ui/submit-button";
import { maintenanceTypeLabels } from "@/lib/labels";
import { formatArs } from "@/lib/contract";
import { formatDate } from "@/lib/datetime";
import { createMaintenance, deleteMaintenance } from "@/app/(app)/vehicles/[id]/maintenance-actions";
import type { VehicleDetail } from "@/lib/vehicle-detail-queries";

export function MaintenanceSection({
  vehicleId,
  isAdmin,
  currentKm,
  logs,
}: {
  vehicleId: string;
  isAdmin: boolean;
  currentKm: number;
  logs: VehicleDetail["maintenanceLogs"];
}) {
  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>Mantenimiento</SectionTitle>

      <form action={createMaintenance.bind(null, vehicleId)} className="flex flex-col gap-3 rounded-xl border border-foreground/10 p-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-foreground/70">Tipo</span>
            <select name="type" className="h-10 rounded-lg border border-foreground/15 bg-transparent px-2 text-sm" defaultValue="service">
              {Object.entries(maintenanceTypeLabels).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-foreground/70">Fecha</span>
            <input type="date" name="date" required className="h-10 rounded-lg border border-foreground/15 bg-transparent px-2 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-foreground/70">Km</span>
            <input type="number" name="km" inputMode="numeric" defaultValue={currentKm} className="h-10 rounded-lg border border-foreground/15 bg-transparent px-2 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-foreground/70">Costo</span>
            <input type="text" name="cost" inputMode="decimal" className="h-10 rounded-lg border border-foreground/15 bg-transparent px-2 text-sm" />
          </label>
        </div>
        <input name="place" placeholder="Lugar / taller (opcional)" className="h-10 rounded-lg border border-foreground/15 bg-transparent px-3 text-sm" />
        <input name="description" required placeholder="Descripción (ej. cambio de aceite y filtros)" className="h-10 rounded-lg border border-foreground/15 bg-transparent px-3 text-sm" />
        <SubmitButton pendingLabel="Agregando…">Agregar registro</SubmitButton>
      </form>

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
