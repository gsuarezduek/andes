import { TextareaField } from "@/components/ui/fields";
import { dropUpload } from "@/lib/client/upload-queue";
import type { StepContext } from "../context";

export function StepFotos({ ctx }: { ctx: StepContext }) {
  const { draft, patch, addPhotos } = ctx;
  return (
    <div className="flex flex-col gap-4">
      <label className="flex h-11 items-center justify-center gap-2 rounded-lg border border-dashed border-foreground/30 text-sm font-medium">
        + Agregar fotos (frente, atrás, laterales)
        <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => addPhotos(e.target.files, "main")} />
      </label>
      {draft.photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {draft.photos.map((p) => (
            <div key={p.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.preview} alt="" className="aspect-square w-full rounded-lg object-cover" />
              {p.status !== "done" && (
                <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40 px-1 text-center text-[10px] leading-tight text-white">
                  {p.status === "uploading" ? "Subiendo…" : "Pendiente de señal"}
                </span>
              )}
              <button type="button" onClick={() => { dropUpload(p.id); patch({ photos: draft.photos.filter((x) => x.id !== p.id) }); }} className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white">✕</button>
            </div>
          ))}
        </div>
      )}
      <TextareaField id="observations" label="Observaciones" value={draft.observations} onChange={(e) => patch({ observations: e.target.value })} rows={4} />
    </div>
  );
}
