"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextField, DateField, FormError } from "@/components/ui/fields";
import { CameraIcon, GalleryIcon } from "@/components/ui/icons";
import { RentalPicker } from "@/components/cash/rental-picker";
import type { RentalPickerOption } from "@/lib/cash";
import { compressImage, uploadMedia } from "@/lib/client/media";
import { createPermit } from "@/app/(app)/permits/actions";

/**
 * Alta de un permiso, colapsada detrás de "+ Nuevo permiso" (mismo criterio
 * que TaskForm en Tareas). El archivo (foto o PDF del formulario) se sube al
 * elegirlo — mismo patrón que AddDamageForm — y solo la clave viaja en el
 * form; el vencimiento usa `DateField` (máscara DD/MM/AAAA) con un input
 * oculto que lleva el valor ISO real (DateField en sí no se envía).
 */
export function PermitForm({ rentalOptions }: { rentalOptions: RentalPickerOption[] }) {
  const [open, setOpen] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>();
  const formRef = useRef<HTMLFormElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setExpiresAt("");
    setFileUrl(null);
    setError(undefined);
    formRef.current?.reset();
    if (cameraRef.current) cameraRef.current.value = "";
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    setError(undefined);
    setUploading(true);
    try {
      // Una foto se comprime (mismo criterio que el resto de la app); un PDF
      // se sube tal cual.
      const blob = file.type.startsWith("image/") ? await compressImage(file) : file;
      const key = await uploadMedia({ draftId: crypto.randomUUID(), kind: "document", blob });
      setFileUrl(key);
    } catch {
      setError("No se pudo subir el archivo. Probá de nuevo.");
      input.value = "";
    } finally {
      setUploading(false);
    }
  }

  async function submit(formData: FormData) {
    setError(undefined);
    if (!formData.get("rentalId")) {
      setError("Elegí la reserva asociada.");
      return;
    }
    if (!expiresAt) {
      setError("Falta el vencimiento del contrato.");
      return;
    }
    try {
      await createPermit(formData);
      reset();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el permiso.");
    }
  }

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        + Nuevo permiso
      </Button>
    );
  }

  return (
    <form ref={formRef} action={submit} className="flex flex-col gap-3 rounded-xl border border-foreground/10 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Nuevo permiso</h2>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="text-xs text-foreground/50"
        >
          Cancelar
        </button>
      </div>

      <RentalPicker options={rentalOptions} label="Reserva asociada" />
      <TextField id="formNumber" label="Número completo de formulario" required maxLength={100} />
      <DateField id="expiresAtInput" label="Vencimiento del contrato" value={expiresAt} onChange={setExpiresAt} />
      <input type="hidden" name="expiresAt" value={expiresAt} />

      <div className="flex flex-col gap-1.5 text-sm">
        <span className="text-foreground/70">Formulario escaneado (foto o PDF, opcional)</span>
        <div className="flex gap-2">
          <label
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-dashed border-foreground/30 text-xs font-medium"
            title="Sacar foto"
          >
            <CameraIcon className="size-4" /> Cámara
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFile}
              className="hidden"
            />
          </label>
          <label
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-dashed border-foreground/30 text-xs font-medium"
            title="Elegir archivo (foto o PDF)"
          >
            <GalleryIcon className="size-4" /> Archivo
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFile}
              className="hidden"
            />
          </label>
        </div>
        {uploading && <span className="text-xs text-foreground/50">Subiendo…</span>}
        {fileUrl && !uploading && <span className="text-xs text-emerald-600">Archivo cargado ✓</span>}
        <input type="hidden" name="fileUrl" value={fileUrl ?? ""} />
      </div>

      <FormError>{error}</FormError>

      <SubmitButton pendingLabel="Guardando…" disabled={uploading}>
        Agregar permiso
      </SubmitButton>
    </form>
  );
}
