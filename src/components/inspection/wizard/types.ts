import type { ContractPricing, RentalPayment } from "@/lib/contract";
import type { InspectionInput, SaveResult, DocumentKindInput } from "@/lib/inspection-input";
import type { CreateRemoteSignatureResult } from "@/app/(app)/rentals/[id]/remote-sign-actions";

export type Lang = "es" | "en";
export type Mode = "handover" | "return";
// "queued" = persistida en el dispositivo, esperando señal para subir.
export type PhotoItem = { id: string; key?: string; status: "uploading" | "queued" | "done" | "error"; preview: string };
export type DamageItem = { id: string; posX: number; posY: number; description: string; photo?: PhotoItem };
// Documento del cliente (licencia/DNI/pasaporte), solo en la entrega. Cuando
// es la licencia de un conductor adicional lleva `holderName` (su nombre).
export type DocItem = { id: string; kind: DocumentKindInput; key?: string; status: "uploading" | "queued" | "done" | "error"; preview: string; holderName?: string };
// Conductor adicional autorizado (además del titular).
export type DriverItem = { id: string; name: string };

// Solo 2 opciones de carga: Licencia y DNI/Pasaporte (el valor `passport` sigue
// existiendo en el enum por compatibilidad, pero ya no se ofrece).
export const DOC_KINDS: DocumentKindInput[] = ["license", "dni"];

export type Draft = {
  draftId: string;
  vehicleId: string;
  language: Lang;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientDocNumber: string;
  clientAddress: string;
  licenseExpiry: string;
  pricing: Record<string, string>;
  // Snapshot de `props.pricing` (precarga desde la reserva/condiciones) al
  // momento de crear el draft. Permite distinguir, al rehidratar desde
  // localStorage, qué valores de `pricing` tocó el empleado a mano de los que
  // solo venían precargados — para no pisar un dato real editado por el
  // empleado, pero tampoco quedar pegado a una precarga vieja si la reserva
  // cambió en VikRentCar (ej. de 1 a 2 días) después de abrir el wizard.
  pricingBaseline: Record<string, string>;
  // "KM libres": sin límite → no se cobra excedente en la devolución.
  unlimitedKm: boolean;
  // "Mejora de Seguro": baja la franquicia (destacado en el acta).
  insuranceUpgrade: boolean;
  accessoriesDesc: string;
  // Forma de la garantía tomada en la entrega (efectivo, tarjeta, etc.).
  guaranteeForm: string;
  // Líneas de pago agregadas en "Pago" (entrega): "Paga" es la suma de sus
  // `adjustedAmount`, ya no se tipea a mano.
  payments: RentalPayment[];
  km: string;
  fuelLevel: number;
  // Neutral por defecto: cada ítem debe decidirse OK/Falla antes de avanzar.
  checklist: Record<string, "ok" | "fail">;
  damages: DamageItem[];
  photos: PhotoItem[];
  documents: DocItem[];
  additionalDrivers: DriverItem[];
  observations: string;
  signerName: string;
  signatureKey?: string;
  // Id de la firma en la cola de subida mientras no hay señal.
  signaturePendingId?: string;
  // Se agotaron los reintentos automáticos de subida de la firma: hay que
  // volver a firmar (no se va a resolver solo). Se limpia al recapturar.
  signatureUploadFailed?: boolean;
  // Liquidación (solo devolución). Guardamos los overrides editables; el total
  // se recalcula en vivo desde la comparación + condiciones de la entrega.
  // Los pagos para saldarla van en `payments` (mismo campo que la entrega).
  settlementFuelCharge: string;
  settlementExtraKmCharge: string; // vacío = usar el auto-calculado
  settlementDeposit: string; // vacío = usar el depósito del contrato
  damageAmounts: Record<string, string>; // por id de daño
};

export type InspectionWizardProps = {
  mode: Mode;
  save: (input: InspectionInput) => Promise<SaveResult>;
  rentalId: string;
  client: { name: string; email: string | null; phone: string | null; dni: string | null; address: string | null };
  datesLabel: string;
  vehicle: { id: string; label: string; currentKm: number } | null;
  vehicleOptions: { id: string; label: string }[];
  checklistItems: { id: string; label: string }[];
  existingDamages: { posX: number; posY: number; description?: string | null }[];
  /** Divisiones del tanque de este vehículo (Vehicle.fuelLevels, 4–16). */
  maxFuel?: number;
  language: Lang;
  licenseExpiry?: string;
  pricing?: Record<string, string>;
  /** Pagos ya cargados antes de la entrega (botón "Agregar pago" en el
   *  detalle de la reserva) — se precargan en "Paga" para no volver a
   *  cobrarlos ni perderlos al guardar (saveHandover reemplaza `pricing`
   *  entero, no lo mergea). */
  initialPayments?: RentalPayment[];
  /** Franquicia estándar y reducida (con mejora de seguro), de Configuración →
   *  Condiciones. Al activar la mejora se cambia la franquicia por la reducida. */
  deductibleBase?: number;
  deductibleReduced?: number;
  /** Medios de pago activos (Configuración → Medios de pago), para "Agregar pago" en la entrega. */
  paymentMethods?: { id: string; name: string; adjustmentPercent?: number; reference?: string; requiresNote?: boolean }[];
  /** custdata de VikRentCar: info de la reserva escrita por el staff (solo lectura). */
  bookingNote?: string;
  /** order_total de VikRentCar (Rental.bookingTotal), para avisar en el paso
   *  Condiciones si el total cargado a mano se aleja mucho del de la reserva
   *  original — no bloquea, es solo una alerta contra errores de tipeo. */
  bookingTotal?: number;
  returnContext?: { handoverKm: number; handoverFuel: number; pricing?: ContractPricing };
  /** Server action para firma remota (el cliente firma en su propio teléfono). */
  createRemoteSignature?: (input: {
    rentalId: string;
    draftId: string;
    type: Mode;
    language: Lang;
    summary: {
      vehicleLabel: string;
      km: number;
      fuelLevel: number;
      newDamages: string[];
      observations?: string;
      clientName?: string;
      datesLabel?: string;
      conditions?: { label: string; value: string }[];
      settlementRows?: { label: string; value: string }[];
      balanceRows?: { label: string; value: string }[];
    };
  }) => Promise<CreateRemoteSignatureResult>;
};
