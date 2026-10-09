"use client";

import { attachmentIcon, formatFileSize } from "@/lib/whatsapp/attachment-kind";

/**
 * Chip con lo que se va a mandar (antes de confirmar el envío). `previewUrl`
 * (si es una foto) lo genera y libera quien la usa — ver SendForm — no un
 * efecto acá: `URL.createObjectURL` en un efecto dispara el lint de
 * "setState dentro de un efecto" (ver inspection-wizard.tsx, que ya resuelve
 * esto generando la preview en el mismo evento que elige el archivo).
 */
export function AttachmentPreview({
  file,
  previewUrl,
  onRemove,
}: {
  file: File;
  previewUrl: string | null;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-foreground/15 bg-foreground/[0.03] px-2.5 py-2">
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- vista previa local, nunca se sube a /_next/image
        <img src={previewUrl} alt="" className="h-10 w-10 rounded object-cover" />
      ) : (
        <span className="text-xl">{attachmentIcon(file.type || "")}</span>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{file.name}</p>
        <p className="text-xs text-foreground/50">{formatFileSize(file.size)}</p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 px-1 text-foreground/40 hover:text-red-600"
        aria-label="Quitar adjunto"
      >
        ✕
      </button>
    </div>
  );
}
