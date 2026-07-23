import { SubmitButton } from "@/components/ui/submit-button";
import { markVehicleService } from "@/app/(app)/rentals/[id]/service-actions";

export function ServiceFormSection({
  rentalId,
  vehicleId,
  currentKm,
  today,
}: {
  rentalId: string;
  vehicleId: string;
  currentKm: number | null;
  today: string;
}) {
  return (
    <details className="rounded-xl border border-foreground/10">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-foreground/70">
        ¿El auto va a service o arreglo? (no hacer entrega)
      </summary>
      <form
        action={markVehicleService.bind(null, rentalId, vehicleId)}
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
            <input type="number" name="km" inputMode="numeric" defaultValue={currentKm ?? ""} className="h-10 rounded-lg border border-foreground/15 bg-transparent px-2 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-foreground/70">Costo</span>
            <input type="text" name="cost" inputMode="decimal" className="h-10 rounded-lg border border-foreground/15 bg-transparent px-2 text-sm" />
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
  );
}
