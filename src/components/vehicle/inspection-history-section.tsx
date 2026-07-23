import { SectionTitle } from "@/components/ui/section-title";
import { formatDateTime } from "@/lib/datetime";
import type { VehicleDetail } from "@/lib/vehicle-detail-queries";

export function InspectionHistorySection({ inspections }: { inspections: VehicleDetail["inspections"] }) {
  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>Inspecciones ({inspections.length})</SectionTitle>
      {inspections.length === 0 ? (
        <p className="rounded-lg border border-foreground/10 px-4 py-3 text-sm text-foreground/50">Sin inspecciones.</p>
      ) : (
        <div className="divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
          {[...inspections].reverse().map((insp) => (
            <div key={insp.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <p className="font-medium">
                  {insp.type === "handover" ? "Entrega" : "Devolución"} · {insp.km.toLocaleString("es-AR")} km
                </p>
                <p className="text-xs text-foreground/50">{insp.rental.clientName} · {formatDateTime(insp.createdAt)}</p>
                <p className="text-xs text-foreground/50">Responsable: {insp.user?.name ?? "—"}</p>
              </div>
              <a className="font-medium underline" href={`/api/acta?inspectionId=${insp.id}`} target="_blank" rel="noopener noreferrer">
                Acta
              </a>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
