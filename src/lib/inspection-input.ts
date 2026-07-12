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

/** Tipo de documento del cliente. Espeja el enum Prisma `DocumentKind`. */
export type DocumentKindInput = "license" | "dni" | "passport";

export type InspectionDocumentInput = {
  kind: DocumentKindInput;
  key: string;
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
  pricing?: Record<string, number>;
  // Documentos del cliente (licencia/DNI/pasaporte), solo en la entrega.
  documents?: InspectionDocumentInput[];
  latitude?: number;
  longitude?: number;
};

export type SaveResult =
  | { ok: true; inspectionId: string }
  | { ok: false; error: string };
