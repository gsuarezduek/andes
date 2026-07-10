"use client";

/**
 * Comprime una imagen en el cliente (redimensiona al lado mayor y recodifica a
 * JPEG) antes de subirla — clave para el flujo con mala señal.
 */
export async function compressImage(
  file: File,
  maxDim = 1600,
  quality = 0.72,
): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  return blob ?? file;
}

export type UploadKind = "photo" | "video" | "signature" | "damage";

/** Sube un blob al endpoint de subida y devuelve la clave de almacenamiento. */
export async function uploadMedia(opts: {
  draftId: string;
  kind: UploadKind;
  blob: Blob;
  id?: string;
}): Promise<string> {
  const fd = new FormData();
  fd.append("draftId", opts.draftId);
  fd.append("kind", opts.kind);
  if (opts.id) fd.append("id", opts.id);
  const ext = opts.kind === "signature" ? "png" : opts.kind === "video" ? "webm" : "jpg";
  fd.append("file", opts.blob, `${opts.id ?? "file"}.${ext}`);

  const res = await fetch("/api/uploads", { method: "POST", body: fd });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error(msg.error ?? "Error al subir el archivo");
  }
  const { key } = (await res.json()) as { key: string };
  return key;
}

/** URL para previsualizar un archivo ya almacenado (vía la ruta autenticada). */
export function mediaUrl(key: string): string {
  return `/api/media?key=${encodeURIComponent(key)}`;
}
