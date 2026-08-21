import type { Dictionary } from "@/lib/i18n";
import type { Settlement } from "@/lib/settlement";

export type ActaRow = { label: string; value: string };
export type ActaChecklist = { label: string; status: "ok" | "fail" };
export type ActaDamage = { view: string; description?: string | null; posX?: number; posY?: number };

export type ActaData = {
  kind: "handover" | "return";
  dict: Dictionary;
  company: {
    name: string;
    legalName: string;
    cuit: string;
    address: string;
    phone: string;
    web: string;
  };
  dateStr: string;
  registeredBy?: string | null;
  vehicleLabel: string;
  plate: string;
  clientRows: ActaRow[];
  /** Conductores autorizados (titular + adicionales), por nombre. */
  authorizedDrivers?: string[];
  termRows: ActaRow[];
  km: number;
  fuelLevel: number;
  /** Divisiones del tanque de este vehículo (para mostrar N/max). */
  fuelLevels: number;
  comparison?: {
    handoverKm: number;
    returnKm: number;
    kmDriven: number;
    handoverFuel: number;
    returnFuel: number;
    fuelDiff: number;
    newDamages: number;
  };
  settlement?: Settlement;
  checklist: ActaChecklist[];
  /** Daños detectados en ESTA inspección (se marcan en rojo en el croquis). */
  damages: ActaDamage[];
  /** Daños activos previos a esta inspección (en ámbar en el croquis) — para
   *  que el croquis del acta siempre refleje el estado real del auto, no solo
   *  lo que se cargó en esta entrega/devolución puntual. */
  existingDamages: ActaDamage[];
  observations?: string | null;
  signerName?: string | null;
  signatureDataUri?: string;
  photoDataUris: string[];
};
