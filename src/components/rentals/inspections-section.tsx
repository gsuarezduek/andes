import { formatDateTime } from "@/lib/datetime";
import type { RentalDetail } from "@/lib/rental-detail-queries";

export function InspectionsSection({ inspections }: { inspections: RentalDetail["inspections"] }) {
  if (inspections.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-foreground/70">Actas</h2>
      <ul className="flex flex-col divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
        {inspections.map((insp) => (
          <li key={insp.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <div>
              <p className="font-medium">
                {insp.type === "handover" ? "Entrega" : "Devolución"}
              </p>
              <p className="text-xs text-foreground/50">
                {formatDateTime(insp.createdAt)} · Responsable:{" "}
                {insp.user?.name ?? "—"}
              </p>
            </div>
            <a
              className="shrink-0 font-medium underline"
              href={`/api/acta?inspectionId=${insp.id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Ver acta PDF
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
