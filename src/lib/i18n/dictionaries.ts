/**
 * Client-facing string dictionaries (es/en).
 *
 * These are the strings the *client* sees: the on-screen signature step,
 * the inspection PDF (acta) and the transactional emails. The employee UI
 * has its own Spanish-only strings and is not covered here.
 *
 * The `es` dictionary is the source of truth for the shape; `en` must satisfy
 * the same `Dictionary` type, so a missing translation is a compile error.
 */

import type { Locale } from "./config";

export type Dictionary = {
  signature: {
    title: string;
    /** Short legal text shown above the signature canvas. */
    legal: string;
    signerName: string;
    clear: string;
    confirm: string;
    acceptState: string;
  };
  acta: {
    handoverTitle: string;
    returnTitle: string;
    vehicle: string;
    client: string;
    date: string;
    mileage: string;
    fuelLevel: string;
    damages: string;
    observations: string;
    signature: string;
    kmDriven: string;
    fuelDifference: string;
    newDamages: string;
  };
  email: {
    handoverSubject: string;
    returnSubject: string;
    greeting: string;
    handoverBody: string;
    returnBody: string;
    attachmentNote: string;
    regards: string;
  };
};

const es: Dictionary = {
  signature: {
    title: "Firma del cliente",
    legal: "Acepto el estado del vehículo descripto en este documento.",
    signerName: "Nombre y aclaración",
    clear: "Borrar",
    confirm: "Firmar y confirmar",
    acceptState: "Al firmar, acepta el estado del vehículo registrado.",
  },
  acta: {
    handoverTitle: "Acta de entrega",
    returnTitle: "Acta de devolución",
    vehicle: "Vehículo",
    client: "Cliente",
    date: "Fecha",
    mileage: "Kilometraje",
    fuelLevel: "Nivel de nafta",
    damages: "Daños",
    observations: "Observaciones",
    signature: "Firma",
    kmDriven: "Kilómetros recorridos",
    fuelDifference: "Diferencia de nafta",
    newDamages: "Daños nuevos",
  },
  email: {
    handoverSubject: "Acta de entrega de su vehículo — MDZ Rent a Car",
    returnSubject: "Acta de devolución de su vehículo — MDZ Rent a Car",
    greeting: "Hola",
    handoverBody:
      "Adjuntamos el acta de entrega del vehículo con el detalle del estado registrado y su firma.",
    returnBody:
      "Adjuntamos el acta de devolución del vehículo, incluyendo la comparación con el estado de entrega.",
    attachmentNote: "El acta en PDF está adjunta a este correo.",
    regards: "Saludos,\nMDZ Rent a Car",
  },
};

const en: Dictionary = {
  signature: {
    title: "Customer signature",
    legal: "I accept the condition of the vehicle described in this document.",
    signerName: "Full name",
    clear: "Clear",
    confirm: "Sign and confirm",
    acceptState: "By signing, you accept the recorded condition of the vehicle.",
  },
  acta: {
    handoverTitle: "Handover report",
    returnTitle: "Return report",
    vehicle: "Vehicle",
    client: "Customer",
    date: "Date",
    mileage: "Mileage",
    fuelLevel: "Fuel level",
    damages: "Damages",
    observations: "Notes",
    signature: "Signature",
    kmDriven: "Kilometers driven",
    fuelDifference: "Fuel difference",
    newDamages: "New damages",
  },
  email: {
    handoverSubject: "Your vehicle handover report — MDZ Rent a Car",
    returnSubject: "Your vehicle return report — MDZ Rent a Car",
    greeting: "Hello",
    handoverBody:
      "Please find attached the vehicle handover report with the recorded condition and your signature.",
    returnBody:
      "Please find attached the vehicle return report, including the comparison against the handover condition.",
    attachmentNote: "The PDF report is attached to this email.",
    regards: "Best regards,\nMDZ Rent a Car",
  },
};

const dictionaries: Record<Locale, Dictionary> = { es, en };

/** Returns the client-facing dictionary for a given locale. */
export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
