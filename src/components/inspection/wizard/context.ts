import type { RefObject } from "react";
import type { Dictionary } from "@/lib/i18n";
import type { Settlement } from "@/lib/settlement";
import type { DocumentKindInput } from "@/lib/inspection-input";
import type { SignaturePadHandle } from "@/components/inspection/signature-canvas";
import type { Draft, InspectionWizardProps } from "./types";

/**
 * Todo lo que un paso del wizard puede necesitar leer o disparar. El estado
 * (`draft` y demás) sigue viviendo únicamente en `InspectionWizard`; los pasos
 * son solo presentación y reciben este contexto como prop.
 */
export type StepContext = {
  props: InspectionWizardProps;
  draft: Draft;
  setDraft: (updater: Draft | ((d: Draft) => Draft)) => void;
  patch: (p: Partial<Draft>) => void;
  dict: Dictionary;
  isHandover: boolean;
  maxFuel: number;
  addPhotos: (files: FileList | null, target: "main" | { damageId: string }) => Promise<void>;
  addDocument: (files: FileList | null, kind: DocumentKindInput, holderName?: string) => Promise<void>;
  priceStr: (k: string) => string;
  setPrice: (k: string, v: string) => void;
  setPay: (k: "total" | "sena" | "paid" | "balance", v: string) => void;
  kmDriven: number;
  fuelDiff: number;
  settlement: Settlement | null;
  signConditionRows?: { label: string; value: string }[];
  generalParagraphs: string[];
  clientAccepted: boolean;
  setClientAccepted: (v: boolean) => void;
  sigRef: RefObject<SignaturePadHandle | null>;
  remote: { id: string; svg: string; url: string } | null;
  remoteStatus: "idle" | "waiting" | "signed" | "error";
  remoteBusy: boolean;
  startRemoteSign: () => Promise<void>;
  cancelRemote: () => void;
  photosPending: boolean;
  // Ya no bloquea la confirmación (ver "avanzar sin señal"): es solo
  // informativo, para que el empleado sepa que puede necesitar reintentar
  // esa foto puntual más tarde.
  photosFailed: boolean;
  online: boolean;
  queuedSubmit: boolean;
  /** Cambiar la unidad asignada sin perder lo demás cargado (entrega). Ver
   *  `fetchHandoverVehicle`: revalida disponibilidad y trae km/nafta/daños del
   *  vehículo nuevo antes de reemplazarlo en el draft. */
  vehicleSwapBusy: boolean;
  swapVehicle: (vehicleId: string) => Promise<void>;
};
