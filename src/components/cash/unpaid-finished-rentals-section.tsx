import Link from "next/link";
import { formatMoney } from "@/lib/contract";
import { formatDateTime } from "@/lib/datetime";
import type { UnpaidFinishedRental } from "@/lib/cash";

/**
 * Alquileres ya devueltos que quedaron con saldo sin cobrar. Lo normal es que
 * no aparezca nada (se cobra antes de cerrar la devolución) — si aparece, es
 * urgente, por eso va arriba de todo en Caja, siempre abierto y en rojo.
 */
export function UnpaidFinishedRentalsSection({ rentals }: { rentals: UnpaidFinishedRental[] }) {
  if (rentals.length === 0) return null;
  const total = rentals.reduce((acc, r) => acc + r.balance, 0);

  return (
    <section role="alert" className="flex flex-col gap-2 rounded-xl border-2 border-red-500 bg-red-500/10 p-3">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-red-700 dark:text-red-400">
          ¡Urgente! Reservas terminadas con pagos pendientes ({rentals.length})
        </h2>
        <p className="shrink-0 text-sm font-bold text-red-700 dark:text-red-400">{formatMoney(total, "ars")}</p>
      </div>
      <p className="text-xs text-foreground/70">
        El auto ya fue devuelto pero la reserva quedó con saldo sin cobrar. Revisá cada una y cargá el
        pago que falte.
      </p>
      <ul className="flex flex-col gap-2">
        {rentals.map((r) => (
          <li key={r.id}>
            <Link
              href={`/rentals/${r.id}`}
              className="flex items-start justify-between gap-3 rounded-lg border border-red-500/40 bg-background px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {r.clientName}
                  {r.bookingId ? <span className="font-normal text-foreground/50"> · #{r.bookingId}</span> : null}
                </p>
                <p className="text-xs text-foreground/50">
                  {r.vehicleLabel} · devuelto {formatDateTime(r.endAt)}
                </p>
                <p className="text-xs text-foreground/50">
                  {r.total != null ? `Total ${formatMoney(r.total, "ars")}` : "Total sin datos"}
                  {r.paid != null ? ` · Pagado ${formatMoney(r.paid, "ars")}` : ""}
                </p>
              </div>
              <p className="shrink-0 font-bold text-red-700 dark:text-red-400">Falta {formatMoney(r.balance, "ars")}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
