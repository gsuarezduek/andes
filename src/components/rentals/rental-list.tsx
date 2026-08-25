import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { rentalStatusDisplay, rentalRowBorderClass, isRentalOverdue } from "@/lib/rental-ui";
import { computeRentalPayments, paymentAccent } from "@/lib/rental-payments";
import { formatDateTime } from "@/lib/datetime";
import { formatArs } from "@/lib/contract";
import type { RentalRow } from "@/lib/rental-list-queries";

// Fila del listado: patente (o modelo) primero, luego el nombre del cliente.
function vehicleTitle(r: RentalRow): string {
  if (r.vehicle) return `${r.vehicle.plate} · ${r.vehicle.brand} ${r.vehicle.model}`;
  if (r.bookingModel) return `${r.bookingModel} · sin unidad asignada`;
  return "Sin vehículo asignado";
}

export function RentalList({
  rentals,
  showBookedAt = false,
}: {
  rentals: RentalRow[];
  /** Muestra cuándo entró la reserva (orden "Fecha de Reserva" de Próximas). */
  showBookedAt?: boolean;
}) {
  const now = new Date();
  return (
    <ul className="flex flex-col divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
      {rentals.map((r) => {
        const { label, tone } = rentalStatusDisplay(r.status, r.bookingConfirmed);
        const notes = r.teamNotes;
        const payments = computeRentalPayments(r);
        const accent = paymentAccent(r.status, r.bookingConfirmed, payments);
        const overdue = isRentalOverdue(r.status, r.startAt, r.endAt, now);
        return (
          <li key={r.id}>
            <Link
              href={`/rentals/${r.id}`}
              className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-foreground/[0.03] ${rentalRowBorderClass(accent, overdue)}`}
            >
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate font-medium">
                  {vehicleTitle(r)}
                  {notes.length > 0 && (
                    <span
                      title={`${notes.length} nota(s) sin resolver`}
                      className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold leading-none text-white"
                    >
                      {notes.length}
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
                {showBookedAt && (
                  <p className="text-xs text-foreground/50">
                    Reserva cargada {formatDateTime(r.bookingCreatedAt ?? r.createdAt)}
                  </p>
                )}
                {notes.length > 0 && (
                  <ul className="mt-1 flex flex-col gap-0.5">
                    {notes.map((n) => (
                      <li key={n.id} className="truncate text-[11px] text-red-600 dark:text-red-400">
                        {n.text}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <Badge tone={tone} ring={accent}>
                  {label}
                </Badge>
                {overdue && (
                  <span className="text-[11px] font-medium text-red-600 dark:text-red-400">
                    {r.status === "active" ? "Devolución vencida" : "Atrasada para entregar"}
                  </span>
                )}
                {accent === "pending" && (
                  <span className="text-[11px] font-medium text-red-600 dark:text-red-400">
                    Falta {formatArs(payments.balance)}
                  </span>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
