/**
 * Payload compartido entre entrega (handover) y devolución (return). El wizard
 * arma este objeto y cada server action valida y persiste lo que corresponde.
 * En devolución se ignoran `pricing` y `licenseExpiry`.
 */
export type InspectionDamageInput = {
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
  // Nombre del titular cuando la foto es la licencia de un conductor adicional.
  holderName?: string;
};

/** Conductor adicional autorizado (además del titular). */
export type AdditionalDriverInput = {
  name: string;
};

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
  km: number;
  fuelLevel: number;
  checklist: Record<string, "ok" | "fail">;
  observations?: string;
  newDamages: InspectionDamageInput[];
  photoKeys: string[];
  videoKey?: string;
  signatureKey: string;
  signerName: string;
  licenseExpiry?: string;
  pricing?: ContractPricing;
  // Documentos del cliente (licencia/DNI/pasaporte), solo en la entrega.
  documents?: InspectionDocumentInput[];
  // Conductores adicionales autorizados (solo en la entrega).
  additionalDrivers?: AdditionalDriverInput[];
  // Liquidación (solo en la devolución): excedente de km, nafta y daños.
  settlement?: Settlement;
  latitude?: number;
  longitude?: number;
};

export type SaveResult =
  | { ok: true; inspectionId: string }
  | { ok: false; error: string };
