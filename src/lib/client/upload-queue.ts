"use client";

/**
 * Cola de subida persistente (IndexedDB) para el flujo con mala señal.
 *
 * Cada archivo capturado (foto, foto de daño, firma) se guarda en el dispositivo
 * apenas se toma y se sube con reintentos. Sobrevive a recargas y a quedarse sin
 * red: cuando vuelve la conexión, la cola drena sola. Integridad de la evidencia:
 * una foto tomada offline no se pierde.
 *
 * Si IndexedDB no está disponible, todo cae a una subida directa (comportamiento
 * anterior) para no romper el flujo.
 */

import { uploadMedia, type UploadKind } from "./media";

export type QueueSlot = "main" | "signature" | `damage:${string}` | `document:${string}`;

export type QueueRecord = {
  id: string;
  draftId: string;
  kind: UploadKind;
  slot: QueueSlot;
  blob: Blob;
  createdAt: number;
};

export type QueueEvent =
  | { id: string; status: "uploading" }
  | { id: string; status: "done"; key: string }
  | { id: string; status: "error" };

const DB_NAME = "andes-uploads";
const STORE = "items";

function idbAvailable(): boolean {
  return typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("draftId", "draftId", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    t.oncomplete = () => db.close();
  });
}

async function putRecord(rec: QueueRecord): Promise<void> {
  await tx("readwrite", (s) => s.put(rec));
}
async function deleteRecord(id: string): Promise<void> {
  await tx("readwrite", (s) => s.delete(id));
}
async function allRecords(): Promise<QueueRecord[]> {
  return tx<QueueRecord[]>("readonly", (s) => s.getAll() as IDBRequest<QueueRecord[]>);
}

// --- Emisor de eventos (el wizard se suscribe para actualizar el estado) ---
const listeners = new Set<(e: QueueEvent) => void>();
export function onQueueEvent(fn: (e: QueueEvent) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function emit(e: QueueEvent) {
  for (const fn of listeners) fn(e);
}

let processing = false;

/** Intenta subir todos los pendientes. Seguro de llamar en cualquier momento. */
export async function processQueue(): Promise<void> {
  if (processing || !idbAvailable()) return;
  processing = true;
  try {
    const records = await allRecords();
    for (const rec of records) {
      emit({ id: rec.id, status: "uploading" });
      try {
        const key = await uploadMedia({
          draftId: rec.draftId,
          kind: rec.kind,
          blob: rec.blob,
          id: rec.id,
        });
        await deleteRecord(rec.id);
        emit({ id: rec.id, status: "done", key });
      } catch {
        // Falla (probablemente sin red): se queda en la cola para reintentar.
        emit({ id: rec.id, status: "error" });
        break; // no seguir martillando si no hay red
      }
    }
  } finally {
    processing = false;
  }
}

/**
 * Encola un archivo: lo persiste y arranca la subida (vía processQueue, que
 * tiene guard contra subidas concurrentes). Si IndexedDB no está, cae a una
 * subida directa. El estado se comunica por eventos (onQueueEvent).
 */
export async function enqueueUpload(rec: Omit<QueueRecord, "createdAt">): Promise<void> {
  if (!idbAvailable()) {
    // Fallback: subida directa, sin persistencia.
    emit({ id: rec.id, status: "uploading" });
    try {
      const key = await uploadMedia({ draftId: rec.draftId, kind: rec.kind, blob: rec.blob, id: rec.id });
      emit({ id: rec.id, status: "done", key });
    } catch {
      emit({ id: rec.id, status: "error" });
    }
    return;
  }
  await putRecord({ ...rec, createdAt: Date.now() });
  await processQueue();
}

/** Registros pendientes (aún no subidos) de un borrador — para rehidratar tras recarga. */
export async function pendingForDraft(draftId: string): Promise<QueueRecord[]> {
  if (!idbAvailable()) return [];
  const all = await allRecords();
  return all.filter((r) => r.draftId === draftId);
}

/** Descarta un pendiente (p. ej. si el usuario borra la foto antes de que suba). */
export async function dropUpload(id: string): Promise<void> {
  if (!idbAvailable()) return;
  await deleteRecord(id);
}

/** Limpia todos los pendientes de un borrador (tras guardar con éxito). */
export async function clearDraftUploads(draftId: string): Promise<void> {
  if (!idbAvailable()) return;
  const all = await allRecords();
  await Promise.all(all.filter((r) => r.draftId === draftId).map((r) => deleteRecord(r.id)));
}

/** Arranca el reintento automático al recuperar conexión. Devuelve un limpiador. */
export function startAutoRetry(): () => void {
  if (typeof window === "undefined") return () => {};
  const onOnline = () => void processQueue();
  window.addEventListener("online", onOnline);
  const interval = window.setInterval(() => {
    if (navigator.onLine) void processQueue();
  }, 15000);
  return () => {
    window.removeEventListener("online", onOnline);
    window.clearInterval(interval);
  };
}
