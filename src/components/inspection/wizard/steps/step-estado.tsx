import { TextField } from "@/components/ui/fields";
import { FuelSelector } from "@/components/inspection/fuel-selector";
import type { StepContext } from "../context";

export function StepEstado({ ctx }: { ctx: StepContext }) {
  const { draft, patch, props, maxFuel } = ctx;
  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-foreground/80">Checklist</p>
          {(() => {
            const pending = props.checklistItems.filter((it) => draft.checklist[it.id] == null).length;
            return pending > 0 ? (
              <span className="text-xs font-medium text-amber-600">Faltan {pending}</span>
            ) : (
              <span className="text-xs font-medium text-emerald-600">Completo ✓</span>
            );
          })()}
        </div>
        <ul className="flex flex-col gap-2">
          {props.checklistItems.map((it) => {
            const val = draft.checklist[it.id]; // undefined = neutro (a decidir)
            return (
              <li key={it.id} className={`flex items-center justify-between gap-3 rounded-lg px-2 py-1 ${val == null ? "bg-amber-500/10" : ""}`}>
                <span className="text-sm">{it.label}</span>
                <div className="flex overflow-hidden rounded-lg border border-foreground/15 text-xs">
                  {(["ok", "fail"] as const).map((opt) => (
                    <button key={opt} type="button" onClick={() => patch({ checklist: { ...draft.checklist, [it.id]: opt } })} className={`px-3 py-1.5 font-medium ${val === opt ? (opt === "ok" ? "bg-green-600 text-white" : "bg-red-600 text-white") : "text-foreground/60"}`}>
                      {opt === "ok" ? "OK" : "Falla"}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <TextField id="km" label="Kilometraje actual" type="number" inputMode="numeric" value={draft.km} onChange={(e) => patch({ km: e.target.value })} min={0} hint={props.returnContext ? `Entrega: ${props.returnContext.handoverKm.toLocaleString("es-AR")} km` : undefined} />
      <div>
        <p className="mb-2 text-sm font-medium text-foreground/80">Nivel de nafta</p>
        <FuelSelector value={draft.fuelLevel} onChange={(v) => patch({ fuelLevel: v })} max={maxFuel} />
      </div>
    </div>
  );
}
