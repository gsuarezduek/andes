"use client";

import { useRef, useState, useTransition } from "react";
import { Croquis, type Marker } from "@/components/inspection/croquis";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/fields";
import { CameraIcon, GalleryIcon } from "@/components/ui/icons";
import { compressImage, uploadMedia } from "@/lib/client/media";
import { addDamage } from "./damage-actions";

/**
 * Registrar un daño manualmente desde el perfil del auto: se marca la ubicación
 * en el croquis, se describe y, opcionalmente, se adjunta una foto. Queda como
 * daño activo (fuera de una inspección) hasta marcarlo reparado.
 */
export function AddDamageForm({
  vehicleId,
  existing,
}: {
  vehicleId: string;
  existing: { posX: number; posY: number }[];
}) {
  const [marker, setMarker] = useState<Marker | null>(null);
  const [description, setDescription] = useState("");
  const [photoKey, setPhotoKey] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const blob = await compressImage(file);
      const key = await uploadMedia({ draftId: crypto.randomUUID(), kind: "damage", blob });
      setPhotoKey(key);
    } catch {
      setError("No se pudo subir la foto. Probá de nuevo.");
      input.value = "";
    } finally {
      setUploading(false);
    }
  }

  function reset() {
    setMarker(null);
    setDescription("");
    setPhotoKey(null);
    if (fileRef.current) fileRef.current.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!marker) {
      setError("Marcá la ubicación del daño en el croquis.");
      return;
    }
    const fd = new FormData();
    fd.set("posX", String(marker.posX));
    fd.set("posY", String(marker.posY));
    if (description.trim()) fd.set("description", description.trim());
    if (photoKey) fd.set("photoKey", photoKey);
    startTransition(async () => {
      try {
        await addDamage(vehicleId, fd);
        reset();
      } catch {
        setError("No se pudo agregar el daño. Probá de nuevo.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-foreground/10 p-4 sm:flex-row sm:items-start">
      <div className="mx-auto w-full max-w-[180px] shrink-0">
        <Croquis
          existing={existing}
          markers={marker ? [marker] : []}
          onAdd={(posX, posY) => setMarker({ id: "new", posX, posY })}
          onRemove={() => setMarker(null)}
        />
        <p className="mt-1 text-center text-[11px] text-foreground/50">
          {marker ? "Tocá el punto rojo para quitarlo" : "Tocá el croquis para marcar el daño"}
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-3">
        <TextField
          id="damage-description"
          label="Descripción"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ej. rayón en puerta trasera derecha"
        />

        <div className="flex flex-col gap-1.5 text-sm">
          <span className="text-foreground/70">Foto (opcional)</span>
          <div className="flex gap-2">
            <label className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-dashed border-foreground/30 text-xs font-medium" title="Sacar foto">
              <CameraIcon className="size-4" /> Cámara
              <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="hidden" />
            </label>
            <label className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-dashed border-foreground/30 text-xs font-medium" title="Elegir de la galería">
              <GalleryIcon className="size-4" /> Galería
              <input ref={galleryRef} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
            </label>
          </div>
          {uploading && <span className="text-xs text-foreground/50">Subiendo foto…</span>}
          {photoKey && !uploading && <span className="text-xs text-emerald-600">Foto cargada ✓</span>}
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <Button type="submit" disabled={pending || uploading}>
          {pending ? "Agregando…" : "Agregar daño"}
        </Button>
      </div>
    </form>
  );
}
