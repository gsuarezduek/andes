import Link from "next/link";
import { SectionTitle } from "@/components/ui/section-title";
import { formatDate } from "@/lib/datetime";
import type { VehicleDetail } from "@/lib/vehicle-detail-queries";

export function RentalHistorySection({ rentals }: { rentals: VehicleDetail["rentals"] }) {
  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>Historial de alquileres ({rentals.length})</SectionTitle>
      {rentals.length === 0 ? (
        <p className="rounded-lg border border-foreground/10 px-4 py-3 text-sm text-foreground/50">Sin alquileres.</p>
      ) : (
        <div className="divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
          {rentals.map((r) => {
            const h = r.inspections.find((i) => i.type === "handover");
            const ret = r.inspections.find((i) => i.type === "return_");
            const driven = h && ret ? ret.km - h.km : null;
            return (
              <Link key={r.id} href={`/rentals/${r.id}`} className="flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-foreground/[0.03]">
                <div>
                  <p className="font-medium">{r.clientName}</p>
                  <p className="text-xs text-foreground/50">{formatDate(r.startAt)} → {formatDate(r.endAt)}</p>
                </div>
                <span className="text-foreground/60">{driven != null ? `${driven.toLocaleString("es-AR")} km` : "—"}</span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
