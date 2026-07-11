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

export type InspectionInput = {
  rentalId: string;
  vehicleId: string;
  language: "es" | "en";
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
  latitude?: number;
  longitude?: number;
};

export type SaveResult =
  | { ok: true; inspectionId: string }
  | { ok: false; error: string };
