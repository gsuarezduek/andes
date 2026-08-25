"use client";

import { useEffect } from "react";
import { onQueueEvent, processQueue, startAutoRetry, clearDraftUploads } from "@/lib/client/upload-queue";
import { inspectionIdForDraft, clearPendingInspection } from "@/lib/client/pending-inspections";
import { attachInspectionEvidence } from "@/app/(app)/evidence-actions";

/**
 * Termina de subir y adjuntar la evidencia (fotos/firma/documentos) de una
 * entrega/devolución que ya se confirmó sin esperarla ("avanzar sin señal",
 * v16). Montado una vez en el layout de toda la app —no dentro del wizard—
 * para que la subida en segundo plano siga funcionando aunque el empleado ya
 * haya navegado a otra pantalla; si cierra la app del todo, retoma solo al
 * volver a abrirla (la cola persiste en IndexedDB, el registro pendiente en
 * localStorage).
 */
export function EvidenceSync() {
  useEffect(() => {
    void processQueue();
    const stopRetry = startAutoRetry();
    const off = onQueueEvent((e) => {
      if (e.status !== "done") return;
      const inspectionId = inspectionIdForDraft(e.draftId);
      if (!inspectionId) return; // no es evidencia de una entrega guardada sin señal
      const kind = e.kind === "damage" ? "damagePhoto" : e.kind;
      void attachInspectionEvidence({ inspectionId, localId: e.id, kind, key: e.key }).then(async (res) => {
        // `complete` es la señal autoritativa (del servidor, contra el
        // manifiesto real) de que no queda nada más pendiente para esta
        // inspección — recién ahí se puede limpiar el registro local.
        if (res.ok && res.complete) {
          clearPendingInspection(e.draftId);
          await clearDraftUploads(e.draftId);
        }
      });
    });
    return () => {
      stopRetry();
      off();
    };
  }, []);

  return null;
}
