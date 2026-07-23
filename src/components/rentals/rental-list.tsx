import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { rentalStatusDisplay } from "@/lib/rental-ui";
import { formatDateTime } from "@/lib/datetime";
import type { RentalRow } from "@/lib/rental-list-queries";

// Fila del listado: patente (o modelo) primero, luego el nombre del cliente.
function vehicleTitle(r: RentalRow): string {
  if (r.vehicle) return `${r.vehicle.plate} · ${r.vehicle.brand} ${r.vehicle.model}`;
  if (r.bookingModel) return `${r.bookingModel} · sin unidad asignada`;
  return "Sin vehículo asignado";
}

export function RentalList({ rentals }: { rentals: RentalRow[] }) {
  return (
    <ul className="flex flex-col divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
      {rentals.map((r) => {
        const { label, tone } = rentalStatusDisplay(r.status, r.bookingConfirmed);
        const noteCount = r._count.teamNotes;
        return (
          <li key={r.id}>
            <Link
              href={`/rentals/${r.id}`}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-foreground/[0.03]"
            >
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate font-medium">
                  {vehicleTitle(r)}
                  {noteCount > 0 && (
                    <span
                      title={`${noteCount} nota(s) sin resolver`}
                      className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold leading-none text-white"
                    >
                      {noteCount}
                    </span>
                  )}
                </p>
                <p className="truncate text-sm text-foreground/70">
                  {r.clientName}
                  {r.wpBookingId ? (
                    <span className="text-foreground/45"> · Orden #{r.wpBookingId}</span>
                  ) : null}
                </p>
                <p className="text-xs text-foreground/50">
                  {formatDateTime(r.startAt)} → {formatDateTime(r.endAt)}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Badge tone={tone}>{label}</Badge>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
