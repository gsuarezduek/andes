"use client";

/**
 * "Avanzar sin señal" (v16): registro en localStorage de qué borradores
 * (`draftId` del wizard) tienen una inspección ya guardada en el servidor
 * pero con evidencia (fotos/firma/documentos) todavía subiendo. Es lo que le
 * permite a `EvidenceSync` (montado en el layout, fuera del wizard) saber a
 * qué inspección adjuntar cada ítem de la cola de subida a medida que
 * termina — incluso si el empleado ya navegó lejos del wizard o cerró y
 * reabrió la app antes de que terminara de subir todo.
 */

const KEY = "andes:pending-inspections";

type Registry = Record<string, string>; // draftId -> inspectionId

function read(): Registry {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Registry) : {};
  } catch {
    return {};
  }
}

function write(reg: Registry) {
  try {
    localStorage.setItem(KEY, JSON.stringify(reg));
  } catch {
    /* cuota llena */
  }
}

export function registerPendingInspection(draftId: string, inspectionId: string) {
  const reg = read();
  reg[draftId] = inspectionId;
  write(reg);
}

export function inspectionIdForDraft(draftId: string): string | undefined {
  return read()[draftId];
}

export function clearPendingInspection(draftId: string) {
  const reg = read();
  if (!(draftId in reg)) return;
  delete reg[draftId];
  write(reg);
}
