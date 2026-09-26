import { TextField } from "@/components/ui/fields";
import { FuelSelector } from "@/components/inspection/fuel-selector";
import type { StepContext } from "../context";
import { kmWarning } from "../logic";

export function StepEstado({ ctx }: { ctx: StepContext }) {
  const { draft, patch, props, maxFuel } = ctx;
  const warning = kmWarning(draft.km, props.mode === "handover", props.vehicle?.currentKm, props.returnContext);
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
                    <button key={opt} type="button" onClick={() => patch({ checklist: { ...draft.checklist, [it.id]: opt } })} className={`flex h-11 items-center justify-center px-4 font-medium ${val === opt ? (opt === "ok" ? "bg-emerald-600 text-white" : "bg-red-600 text-white") : "text-foreground/60"}`}>
                      {opt === "ok" ? "OK" : "Falla"}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <TextField id="km" label="Kilometraje actual" type="number" inputMode="numeric" value={draft.km} onChange={(e) => patch({ km: e.target.value, kmConfirmed: false })} min={0} hint={props.returnContext ? `Entrega: ${props.returnContext.handoverKm.toLocaleString("es-AR")} km` : undefined} />
      {warning && (
        <div role="alert" className="-mt-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          <p className="font-medium text-amber-800 dark:text-amber-300">Revisá el kilometraje</p>
          <p className="mt-1 text-foreground/80">{warning}</p>
          <label className="mt-2 flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.kmConfirmed}
              onChange={(e) => patch({ kmConfirmed: e.target.checked })}
              className="size-5"
            />
            Confirmo que el kilometraje es correcto
          </label>
        </div>
      )}
      <div>
        <p className="mb-2 text-sm font-medium text-foreground/80">Nivel de nafta</p>
        <FuelSelector value={draft.fuelLevel} onChange={(v) => patch({ fuelLevel: v })} max={maxFuel} />
      </div>
    </div>
  );
}
