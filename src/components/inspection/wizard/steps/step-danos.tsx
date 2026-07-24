import { Croquis, type Marker } from "@/components/inspection/croquis";
import { newId } from "../new-id";
import type { StepContext } from "../context";

export function StepDanos({ ctx }: { ctx: StepContext }) {
  const { draft, setDraft, props, addPhotos } = ctx;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-foreground/60">
        Tocá el croquis para marcar un daño nuevo. Los <span className="text-amber-600">ámbar</span> ya estaban registrados.
      </p>
      <div className="mx-auto w-full max-w-[240px]">
        <Croquis existing={props.existingDamages} markers={draft.damages as Marker[]} onAdd={(posX, posY) => setDraft((d) => ({ ...d, damages: [...d.damages, { id: newId(), posX, posY, description: "" }] }))} onRemove={(id) => setDraft((d) => ({ ...d, damages: d.damages.filter((x) => x.id !== id) }))} />
      </div>
      {props.existingDamages.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
            Daños ya registrados ({props.existingDamages.length})
          </p>
          <ul className="mt-1 list-disc pl-4 text-sm text-foreground/70">
            {props.existingDamages.map((d, i) => (
              <li key={i}>{d.description?.trim() || "Daño sin descripción"}</li>
            ))}
          </ul>
        </div>
      )}
      {draft.damages.map((dm, i) => (
        <div key={dm.id} className="flex flex-col gap-2 rounded-lg border border-foreground/10 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Daño nuevo #{i + 1}</span>
            <button type="button" className="text-xs text-red-600" onClick={() => setDraft((d) => ({ ...d, damages: d.damages.filter((x) => x.id !== dm.id) }))}>Quitar</button>
          </div>
          <input className="h-10 w-full rounded-lg border border-foreground/15 bg-transparent px-3 text-sm outline-none focus:border-foreground/40" placeholder="Descripción (ej. rayón puerta delantera)" value={dm.description} onChange={(e) => setDraft((d) => ({ ...d, damages: d.damages.map((x) => (x.id === dm.id ? { ...x, description: e.target.value } : x)) }))} />
          {dm.photo ? (
            <div className="relative h-20 w-20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={dm.photo.preview} alt="" className="h-20 w-20 rounded object-cover" />
              {dm.photo.status !== "done" && (
                <span className="absolute inset-0 flex items-center justify-center rounded bg-black/40 px-1 text-center text-[9px] leading-tight text-white">
                  {dm.photo.status === "uploading" ? "Subiendo…" : "Pendiente"}
                </span>
              )}
            </div>
          ) : (
            <label className="text-xs text-foreground/60 underline">
              Agregar foto del daño
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => addPhotos(e.target.files, { damageId: dm.id })} />
            </label>
          )}
        </div>
      ))}
    </div>
  );
}
