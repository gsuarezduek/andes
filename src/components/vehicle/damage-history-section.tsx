import { Badge } from "@/components/ui/badge";
import { SectionTitle } from "@/components/ui/section-title";
import { formatDateTime } from "@/lib/datetime";
import type { VehicleDetail } from "@/lib/vehicle-detail-queries";

export function DamageHistorySection({ damages }: { damages: VehicleDetail["damages"] }) {
  return (
    <section className="flex flex-col gap-2">
      <SectionTitle>Historial de daños ({damages.length})</SectionTitle>
      {damages.length === 0 ? (
        <p className="rounded-lg border border-foreground/10 px-4 py-3 text-sm text-foreground/50">Sin daños registrados.</p>
      ) : (
        <ul className="divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
          {damages.map((d) => (
            <li key={d.id} className="flex flex-col gap-1 px-4 py-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 font-medium">{d.description || "Daño sin descripción"}</span>
                <Badge tone={d.repaired ? "neutral" : "amber"}>{d.repaired ? "Reparado" : "Activo"}</Badge>
              </div>
              <p className="text-xs text-foreground/50">
                {d.reportedBy?.name ? `Cargado por ${d.reportedBy.name}` : "Cargado"} · {formatDateTime(d.createdAt)}
              </p>
              {d.repaired && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  {d.repairedBy?.name ? `Reparado por ${d.repairedBy.name}` : "Reparado"}
                  {d.repairedAt ? ` · ${formatDateTime(d.repairedAt)}` : ""}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
