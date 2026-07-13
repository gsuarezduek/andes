"use client";

import { useRef, useState, useTransition } from "react";
import { Croquis, type Marker } from "@/components/inspection/croquis";
import { Button } from "@/components/ui/button";
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

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const blob = await compressImage(file);
      const key = await uploadMedia({ draftId: crypto.randomUUID(), kind: "damage", blob });
      setPhotoKey(key);
    } catch {
      setError("No se pudo subir la foto. Probá de nuevo.");
      if (fileRef.current) fileRef.current.value = "";
    } finally {
      setUploading(false);
    }
  }

  function reset() {
    setMarker(null);
    setDescription("");
    setPhotoKey(null);
    if (fileRef.current) fileRef.current.value = "";
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
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-foreground/70">Descripción</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ej. rayón en puerta trasera derecha"
            className="h-10 rounded-lg border border-foreground/15 bg-transparent px-3 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-foreground/70">Foto (opcional)</span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhoto}
            className="text-sm text-foreground/70 file:mr-3 file:rounded-lg file:border-0 file:bg-foreground/10 file:px-3 file:py-2 file:text-sm"
          />
          {uploading && <span className="text-xs text-foreground/50">Subiendo foto…</span>}
          {photoKey && !uploading && <span className="text-xs text-emerald-600">Foto cargada ✓</span>}
        </label>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <Button type="submit" disabled={pending || uploading}>
          {pending ? "Agregando…" : "Agregar daño"}
        </Button>
      </div>
    </form>
  );
}
