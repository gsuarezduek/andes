/**
 * Payload compartido entre entrega (handover) y devolución (return). El wizard
 * arma este objeto y cada server action valida y persiste lo que corresponde.
 * En devolución se ignoran `pricing` y `licenseExpiry`.
 */
export type InspectionDamageInput = {
  // Id generado en el cliente (uuid), estable durante todo el wizard. Se
  // persiste como el id real del `Damage` para poder engancharle la foto más
  // tarde si no llegó a subir a tiempo (ver `PendingEvidenceInput`).
  id?: string;
  view: "top" | "front" | "rear" | "left" | "right" | "interior";
  posX: number;
  posY: number;
  description?: string;
  photoKey?: string;
};

import type { Settlement } from "@/lib/settlement";
import type { ContractPricing } from "@/lib/contract";

/** Tipo de documento del cliente. Espeja el enum Prisma `DocumentKind`. */
export type DocumentKindInput = "license" | "dni" | "passport";

export type InspectionDocumentInput = {
  kind: DocumentKindInput;
  key: string;
  // Id generado en el cliente (uuid) — mismo criterio que `InspectionDamageInput.id`,
  // se persiste como el id real del `RentalDocument`.
  localId: string;
  // Nombre del titular cuando la foto es la licencia de un conductor adicional.
  holderName?: string;
};

/** Conductor adicional autorizado (además del titular). */
export type AdditionalDriverInput = {
  name: string;
};

/**
 * "Avanzar sin señal": describe un ítem de evidencia que el empleado ya
 * capturó (foto, firma, documento) pero que todavía no terminó de subir a R2
 * al momento de confirmar la entrega/devolución. `saveHandover`/`saveReturn`
 * lo guardan tal cual en `Inspection.pendingEvidence`; `attachInspectionEvidence`
 * (`src/app/(app)/evidence-actions.ts`) lo resuelve solo, en segundo plano,
 * a medida que cada ítem termina de subir — sin bloquear la confirmación.
 */
export type PendingEvidenceInput =
  | { kind: "signature"; localId: string }
  | { kind: "photo"; localId: string }
  | { kind: "video"; localId: string }
  | { kind: "damagePhoto"; localId: string; damageId: string }
  | { kind: "document"; localId: string; docKind: DocumentKindInput; holderName?: string };

export type InspectionInput = {
  rentalId: string;
  vehicleId: string;
  language: "es" | "en";
  // Datos del cliente, editables al iniciar la entrega (una reserva de
  // VikRentCar puede llegar sin nombre). Se ignoran en la devolución.
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientDocNumber?: string;
  clientAddress?: string;
  km: number;
  fuelLevel: number;
  checklist: Record<string, "ok" | "fail">;
  observations?: string;
  newDamages: InspectionDamageInput[];
  photoKeys: string[];
  videoKey?: string;
  // Vacío/ausente cuando la firma se capturó pero todavía no subió (ver
  // `pendingEvidence`, entrada `kind: "signature"`) — "avanzar sin señal".
  signatureKey?: string;
  signerName: string;
  licenseExpiry?: string;
  pricing?: ContractPricing;
  // Documentos del cliente (licencia/DNI/pasaporte), solo en la entrega. Solo
  // los que ya tienen `key` (subidos); los pendientes van en `pendingEvidence`.
  documents?: InspectionDocumentInput[];
  // Conductores adicionales autorizados (solo en la entrega).
  additionalDrivers?: AdditionalDriverInput[];
  // Liquidación (solo en la devolución): excedente de km, nafta y daños.
  settlement?: Settlement;
  latitude?: number;
  longitude?: number;
  // "Avanzar sin señal": fotos/firma/documentos capturados localmente que
  // todavía no terminaron de subir a R2. Ver `PendingEvidenceInput`.
  pendingEvidence?: PendingEvidenceInput[];
};

export type SaveResult =
  | { ok: true; inspectionId: string }
  | { ok: false; error: string };
