import { TextareaField } from "@/components/ui/fields";
import { CameraIcon, GalleryIcon, CloseIcon } from "@/components/ui/icons";
import { dropUpload } from "@/lib/client/upload-queue";
import type { StepContext } from "../context";

export function StepFotos({ ctx }: { ctx: StepContext }) {
  const { draft, patch, addPhotos } = ctx;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <label className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-dashed border-foreground/30 text-sm font-medium" title="Sacar foto">
          <CameraIcon /> Cámara
          <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => addPhotos(e.target.files, "main")} />
        </label>
        <label className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-dashed border-foreground/30 text-sm font-medium" title="Elegir de la galería">
          <GalleryIcon /> Galería
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => addPhotos(e.target.files, "main")} />
        </label>
      </div>
      {draft.photos.length === 0 && (
        <p className="text-xs font-medium text-amber-600">Obligatorio: agregá al menos una foto para continuar.</p>
      )}
      {draft.photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {draft.photos.map((p) => (
            <div key={p.id} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.preview} alt="" className="aspect-square w-full rounded-lg object-cover" />
              {p.status !== "done" && (
                <span className={`absolute inset-0 flex items-center justify-center rounded-lg px-1 text-center text-[10px] leading-tight text-white ${p.status === "error" ? "bg-red-600/80" : "bg-black/40"}`}>
                  {p.status === "uploading" ? "Subiendo…" : p.status === "error" ? "No se pudo subir" : "Pendiente de señal"}
                </span>
              )}
              <button type="button" onClick={() => { dropUpload(p.id); patch({ photos: draft.photos.filter((x) => x.id !== p.id) }); }} aria-label="Quitar foto" className="absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white">
                <CloseIcon />
              </button>
            </div>
          ))}
        </div>
      )}
      <TextareaField id="observations" label="Observaciones" value={draft.observations} onChange={(e) => patch({ observations: e.target.value })} rows={4} />
    </div>
  );
}
