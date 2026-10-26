"use client";

import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Modal } from "@/components/ui/modal";
import { ConfirmDeleteCard } from "@/components/ui/confirm-delete-card";
import { TextField, DateField, FormError } from "@/components/ui/fields";
import { ChevronRightIcon, CameraIcon, GalleryIcon } from "@/components/ui/icons";
import { formatDateTime } from "@/lib/datetime";
import { compressImage, uploadMedia, mediaUrl } from "@/lib/client/media";
import { updatePermit, deletePermit } from "@/app/(app)/permits/actions";
import type { PermitRow as PermitRowData } from "@/lib/permits";

/** "YYYY-MM-DD" → "DD/MM/YYYY" (fecha pura, sin zona horaria — mismo criterio que Habitaciones). */
function fmt(key: string): string {
  return `${key.slice(8, 10)}/${key.slice(5, 7)}/${key.slice(0, 4)}`;
}

const MODAL_TITLES = { view: "Permiso", edit: "Editar permiso", confirmDelete: "Eliminar permiso" } as const;

/**
 * Fila de un permiso — en reposo muestra lo esencial (número, cliente,
 * vehículo y fecha de carga); el resto (formulario, vencimiento, archivo,
 * quién lo cargó) y las acciones de Editar/Eliminar (solo admin) viven en el
 * modal, mismo patrón que MovementRow en Caja.
 */
export function PermitRow({ permit, isAdmin }: { permit: PermitRowData; isAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-lg border border-foreground/10 text-sm">
      <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center gap-3 px-3 py-2 text-left">
        <span className="shrink-0 font-mono text-xs text-foreground/50">#{permit.number}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{permit.clientName}</p>
          <p className="mt-0.5 truncate text-xs text-foreground/50">
            {permit.vehicleLabel ?? "Sin vehículo"} · {formatDateTime(permit.createdAt)}
          </p>
        </div>
        <ChevronRightIcon className="size-4 shrink-0 text-foreground/30" />
      </button>

      <PermitDetailModal permit={permit} isAdmin={isAdmin} open={open} onClose={() => setOpen(false)} />
    </li>
  );
}

function PermitDetailModal({
  permit,
  isAdmin,
  open,
  onClose,
}: {
  permit: PermitRowData;
  isAdmin: boolean;
  open: boolean;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "confirmDelete">("view");

  function handleClose() {
    setMode("view");
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title={MODAL_TITLES[mode]}>
      {mode === "view" && (
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-semibold">Contrato N° {permit.number}</p>
          </div>
          <dl className="flex flex-col gap-1.5 border-t border-foreground/10 pt-3 text-sm">
            <DetailRow
              label="Reserva"
              value={
                <Link href={`/rentals/${permit.rentalId}`} className="underline hover:text-foreground/70">
                  {permit.clientName}
                </Link>
              }
            />
            <DetailRow label="Vehículo" value={permit.vehicleLabel ?? "—"} />
            <DetailRow label="N° de formulario" value={permit.formNumber} />
            <DetailRow label="Vencimiento" value={fmt(permit.expiresAt)} />
            <DetailRow
              label="Archivo"
              value={
                permit.fileUrl ? (
                  <a href={mediaUrl(permit.fileUrl)} target="_blank" rel="noreferrer" className="underline hover:text-foreground/70">
                    Ver archivo
                  </a>
                ) : (
                  "Sin archivo"
                )
              }
            />
            <DetailRow label="Cargado por" value={`${permit.createdByName} · ${formatDateTime(permit.createdAt)}`} />
          </dl>
          {isAdmin && (
            <div className="mt-1 flex gap-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setMode("edit")}>
                Editar
              </Button>
              <Button type="button" variant="danger" className="flex-1" onClick={() => setMode("confirmDelete")}>
                Eliminar
              </Button>
            </div>
          )}
        </div>
      )}

      {mode === "edit" && <PermitEditForm permit={permit} onCancel={() => setMode("view")} onDone={handleClose} />}

      {mode === "confirmDelete" && (
        <ConfirmDeleteCard
          as="div"
          message={<>¿Eliminar el permiso N° {permit.number} ({permit.clientName})? No va a aparecer más en el listado.</>}
          action={deletePermit.bind(null, permit.id)}
          onCancel={() => setMode("view")}
        />
      )}
    </Modal>
  );
}

function PermitEditForm({
  permit,
  onCancel,
  onDone,
}: {
  permit: PermitRowData;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [expiresAt, setExpiresAt] = useState(permit.expiresAt);
  const [fileUrl, setFileUrl] = useState<string | null>(permit.fileUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>();
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;
    setError(undefined);
    setUploading(true);
    try {
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
    if (!expiresAt) {
      setError("Falta el vencimiento del contrato.");
      return;
    }
    try {
      await updatePermit(permit.id, formData);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el permiso.");
    }
  }

  return (
    <form action={submit} className="flex flex-col gap-3">
      <TextField id="formNumber" label="Número completo de formulario" defaultValue={permit.formNumber} required maxLength={100} />
      <DateField id="expiresAtInput" label="Vencimiento del contrato" value={expiresAt} onChange={setExpiresAt} />
      <input type="hidden" name="expiresAt" value={expiresAt} />

      <div className="flex flex-col gap-1.5 text-sm">
        <span className="text-foreground/70">Formulario escaneado (foto o PDF)</span>
        {fileUrl && !uploading && (
          <a href={mediaUrl(fileUrl)} target="_blank" rel="noreferrer" className="text-xs underline">
            Ver archivo actual
          </a>
        )}
        <div className="flex gap-2">
          <label className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-dashed border-foreground/30 text-xs font-medium" title="Sacar foto">
            <CameraIcon className="size-4" /> Cámara
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleFile} className="hidden" />
          </label>
          <label className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-dashed border-foreground/30 text-xs font-medium" title="Elegir archivo (foto o PDF)">
            <GalleryIcon className="size-4" /> Reemplazar
            <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={handleFile} className="hidden" />
          </label>
        </div>
        {uploading && <span className="text-xs text-foreground/50">Subiendo…</span>}
        <input type="hidden" name="fileUrl" value={fileUrl ?? ""} />
      </div>

      <FormError>{error}</FormError>

      <div className="mt-1 flex items-center gap-3">
        <button type="button" onClick={onCancel} className="text-xs text-foreground/50">
          Cancelar
        </button>
        <SubmitButton pendingLabel="Guardando…" className="ml-auto" disabled={uploading}>
          Guardar
        </SubmitButton>
      </div>
    </form>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-foreground/50">{label}</dt>
      <dd className="min-w-0 text-right">{value}</dd>
    </div>
  );
}
