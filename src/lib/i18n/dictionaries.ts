/**
 * Client-facing string dictionaries (es/en).
 *
 * These are the strings the *client* sees: the on-screen signature step,
 * the inspection PDF (acta / contrato) and the transactional emails.
 *
 * The `es` dictionary is the source of truth for the shape; `en` must satisfy
 * the same `Dictionary` type, so a missing translation is a compile error.
 *
 * ⚠️ El texto legal en inglés es una traducción de referencia; el contrato es
 * argentino y su versión legalmente vinculante es la española. Revisar con la
 * empresa antes de usar el inglés en producción legal.
 */

import type { Locale } from "./config";

export type Dictionary = {
  signature: {
    title: string;
    legal: string;
    signerName: string;
    clear: string;
    confirm: string;
    acceptState: string;
    acceptConditions: string;
  };
  acta: {
    handoverTitle: string;
    returnTitle: string;
    conditionsTitle: string;
    vehicleStateTitle: string;
    clientTitle: string;
    authorizedDrivers: string;
    termsTitle: string;
    vehicle: string;
    plate: string;
    client: string;
    date: string;
    registeredBy: string;
    place: string;
    dni: string;
    licenseExpiry: string;
    mileage: string;
    fuelLevel: string;
    from: string;
    to: string;
    days: string;
    dailyRate: string;
    insurance: string;
    kmIncluded: string;
    unlimitedKm: string;
    extraKm: string;
    extraHour: string;
    extraHourAmount: string;
    accessories: string;
    guaranteeForm: string;
    total: string;
    paid: string;
    balance: string;
    deposit: string;
    damages: string;
    observations: string;
    signature: string;
    kmDriven: string;
    fuelDifference: string;
    newDamages: string;
    fuelPolicy: string;
    settlement: {
      title: string;
      extraKm: string;
      fuel: string;
      damage: string;
      subtotal: string;
      depositApplied: string;
      balanceDue: string;
      depositReturn: string;
      method: string;
      methods: { efectivo: string; transferencia: string; retencion_deposito: string; none: string };
      note: string;
    };
  };
  legal: {
    title: string;
    paragraphs: string[];
    photoConsent: string;
    jurisdiction: string;
    acceptance: string;
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
    legal:
      "Declaro haber leído y aceptado las condiciones de alquiler y el estado del vehículo descriptos en este documento.",
    signerName: "Nombre y aclaración",
    clear: "Borrar",
    confirm: "Firmar y confirmar",
    acceptState: "Al firmar, acepta las condiciones y el estado del vehículo registrado.",
    acceptConditions: "Leí y acepto las condiciones generales de alquiler y el estado del vehículo.",
  },
  acta: {
    handoverTitle: "Acta de entrega",
    returnTitle: "Acta de devolución",
    conditionsTitle: "Condiciones de alquiler y estado del vehículo",
    vehicleStateTitle: "Estado del vehículo",
    clientTitle: "Cliente",
    authorizedDrivers: "Conductores autorizados",
    termsTitle: "Condiciones del alquiler",
    vehicle: "Vehículo",
    plate: "Dominio",
    client: "Cliente",
    date: "Fecha",
    registeredBy: "Registrado por",
    place: "Lugar",
    dni: "DNI",
    licenseExpiry: "Venc. licencia de conducir",
    mileage: "Kilometraje",
    fuelLevel: "Nivel de nafta",
    from: "Desde",
    to: "Hasta",
    days: "Cant. días",
    dailyRate: "Precio por día",
    insurance: "Seguro con franquicia",
    kmIncluded: "Km para uso",
    unlimitedKm: "Libre (sin cargo por excedente)",
    extraKm: "Km extra",
    extraHour: "Hora extra",
    extraHourAmount: "Hora extra (importe)",
    accessories: "Accesorios",
    guaranteeForm: "Forma de garantía",
    total: "Total a pagar",
    paid: "Paga",
    balance: "Saldo",
    deposit: "Excedentes / depósito",
    damages: "Daños",
    observations: "Observaciones",
    signature: "Firma",
    kmDriven: "Kilómetros recorridos",
    fuelDifference: "Diferencia de nafta",
    newDamages: "Daños nuevos",
    fuelPolicy:
      "MDZ Rent a Car no hace reintegros por sobrante de combustible. En caso de faltante de combustible se cobrará la diferencia al valor del litro de nafta premium del día. Por pinchadura o rotura de neumáticos y/o sus componentes el cliente es total responsable de la reparación.",
    settlement: {
      title: "Liquidación",
      extraKm: "Km extra",
      fuel: "Nafta faltante",
      damage: "Daño",
      subtotal: "Subtotal",
      depositApplied: "Cubierto por depósito",
      balanceDue: "Saldo a cobrar",
      depositReturn: "Depósito a devolver",
      method: "Forma de pago",
      methods: {
        efectivo: "Efectivo",
        transferencia: "Transferencia",
        retencion_deposito: "Retención del depósito",
        none: "Sin saldo",
      },
      note: "Nota",
    },
  },
  legal: {
    title: "Condiciones generales",
    paragraphs: [
      "Entrega y devolución del vehículo. En ambas oportunidades se constatará el estado general del vehículo, indicándose existencia de daños y faltantes, kilometraje y carga de combustible. Si el departamento técnico de MDZ Rent a Car constatara daños, faltantes y/o desperfectos ocultos, se le notificará al CLIENTE, pudiendo exigir las diferencias resultantes. La no devolución del rodado por parte del CLIENTE, en tiempo y forma, se considerará, transcurrida 48 hs. de vencido el plazo, sin necesidad de requerimiento previo, retención indebida en los términos de la legislación penal, pudiendo MDZ Rent a Car iniciar las acciones penales y/o civiles que correspondan y reclamar los daños, lucro cesante, etc., más un interés punitorio adicional por mora.",
      "Responsabilidad del CLIENTE. El mismo es responsable, durante el período que éste tiene la posesión del vehículo, por toda multa y/o sanción que se reclame a MDZ Rent a Car, por violación de la legislación argentina y por todo daño causado a bienes y/o lesiones producidos a terceros. Por todo daño, pérdida, sustracción, hurto, robo, faltante, rotura, etc., que sufra el rodado, sin importar la causa. Todo costo derivado de la inutilización del vehículo, lucro cesante, remolque, traslado, asistencia mecánica, etc., originado bajo su responsabilidad y conforme al seguro contratado.",
      "Obligaciones del CLIENTE. No dejará conducir a otra persona sin previa autorización de MDZ Rent a Car, y de ser autorizado, éste adquiere las mismas obligaciones y responsabilidades del CLIENTE. No podrá utilizar el vehículo para transporte de cosas prohibidas por normas legales, equipos inflamables y peligrosos, etc. Tampoco para remolcar o empujar otros vehículos o equipos ni para participar de eventos como carreras, pruebas, competiciones deportivas, aprendizaje de conducción, etc. Se abstendrá de conducir bajo la influencia de cualquier tipo de medicación, alcohol o sustancia que pudieran afectar su capacidad de conducción. Deberá devolver la documentación que se le entregó del vehículo (tarjeta verde y póliza de seguro) y el vehículo en tiempo y lugar convenidos. Comunicará en forma inmediata a MDZ Rent a Car todo siniestro y/o medida cautelar que recaiga sobre el vehículo. En caso de siniestro, deberá efectuar la denuncia policial y/o exposición civil que correspondiere.",
    ],
    photoConsent:
      "Mediante la firma de este contrato, el cliente aprueba el uso de las fotografías que MDZ Rent a Car pueda tomar del mismo para uso publicitario de la empresa.",
    jurisdiction:
      "Las partes se someten frente a cualquier conflicto que pudiera surgir del presente contrato a la primera circunscripción judicial de la provincia de Mendoza, renunciando a cualquier otra jurisdicción.",
    acceptance:
      "El CLIENTE se obliga por este medio a cumplir con todas las normas que en este acuerdo se especifican.",
  },
  email: {
    handoverSubject: "Acta de entrega de su vehículo — MDZ Rent a Car",
    returnSubject: "Acta de devolución de su vehículo — MDZ Rent a Car",
    greeting: "Hola",
    handoverBody:
      "Adjuntamos el acta de entrega del vehículo con las condiciones de alquiler, el estado registrado y su firma.",
    returnBody:
      "Adjuntamos el acta de devolución del vehículo, incluyendo la comparación con el estado de entrega.",
    attachmentNote: "El acta en PDF está adjunta a este correo.",
    regards: "Saludos,\nMDZ Rent a Car",
  },
};

const en: Dictionary = {
  signature: {
    title: "Customer signature",
    legal:
      "I declare that I have read and accepted the rental conditions and the vehicle condition described in this document.",
    signerName: "Full name",
    clear: "Clear",
    confirm: "Sign and confirm",
    acceptState: "By signing, you accept the conditions and the recorded condition of the vehicle.",
    acceptConditions: "I have read and accept the general rental conditions and the vehicle condition.",
  },
  acta: {
    handoverTitle: "Handover report",
    returnTitle: "Return report",
    conditionsTitle: "Rental conditions and vehicle condition",
    vehicleStateTitle: "Vehicle condition",
    clientTitle: "Customer",
    authorizedDrivers: "Authorized drivers",
    termsTitle: "Rental terms",
    vehicle: "Vehicle",
    plate: "Plate",
    client: "Customer",
    date: "Date",
    registeredBy: "Registered by",
    place: "Location",
    dni: "ID",
    licenseExpiry: "Driver's license expiry",
    mileage: "Mileage",
    fuelLevel: "Fuel level",
    from: "From",
    to: "To",
    days: "Days",
    dailyRate: "Daily rate",
    insurance: "Insurance with excess",
    kmIncluded: "Included km",
    unlimitedKm: "Unlimited (no excess charge)",
    extraKm: "Extra km",
    extraHour: "Extra hour",
    extraHourAmount: "Extra hour (amount)",
    accessories: "Accessories",
    guaranteeForm: "Guarantee method",
    total: "Total due",
    paid: "Paid",
    balance: "Balance",
    deposit: "Deposit / hold",
    damages: "Damages",
    observations: "Notes",
    signature: "Signature",
    kmDriven: "Kilometers driven",
    fuelDifference: "Fuel difference",
    newDamages: "New damages",
    fuelPolicy:
      "MDZ Rent a Car does not refund surplus fuel. If fuel is missing, the difference is charged at the day's premium fuel price per liter. The customer is fully responsible for repairs to punctured or damaged tires and/or their components.",
    settlement: {
      title: "Settlement",
      extraKm: "Extra km",
      fuel: "Missing fuel",
      damage: "Damage",
      subtotal: "Subtotal",
      depositApplied: "Covered by deposit",
      balanceDue: "Balance due",
      depositReturn: "Deposit to refund",
      method: "Payment method",
      methods: {
        efectivo: "Cash",
        transferencia: "Bank transfer",
        retencion_deposito: "Deposit withholding",
        none: "No balance",
      },
      note: "Note",
    },
  },
  legal: {
    title: "General conditions",
    paragraphs: [
      "Vehicle handover and return. On both occasions the general condition of the vehicle will be verified, noting any damage or missing items, mileage and fuel level. If MDZ Rent a Car's technical department finds hidden damage, missing items or defects, the CUSTOMER will be notified and may be required to pay the resulting differences. Failure to return the vehicle on time and in the agreed manner will be considered, 48 hours after the deadline and without prior notice, undue retention under criminal law, and MDZ Rent a Car may initiate the applicable criminal and/or civil actions and claim damages, lost profits, etc., plus additional default interest.",
      "CUSTOMER liability. During the period the CUSTOMER holds the vehicle, they are liable for any fine and/or penalty claimed against MDZ Rent a Car for violation of Argentine law, and for any damage to property and/or injury caused to third parties; for any damage, loss, theft, robbery, missing item or breakage suffered by the vehicle, regardless of cause; and for any cost arising from the vehicle being out of service, lost profits, towing, transport, mechanical assistance, etc., under their responsibility and according to the contracted insurance.",
      "CUSTOMER obligations. The CUSTOMER will not let another person drive without prior authorization from MDZ Rent a Car; if authorized, that person assumes the same obligations and liabilities. The vehicle may not be used to transport goods prohibited by law, flammable or dangerous equipment, etc., nor to tow or push other vehicles, nor to take part in races, tests, sporting competitions, driving lessons, etc. The CUSTOMER will not drive under the influence of any medication, alcohol or substance affecting their ability to drive. They must return the vehicle's documentation (registration card and insurance policy) and the vehicle at the agreed time and place, and immediately report to MDZ Rent a Car any accident or precautionary measure affecting the vehicle. In case of an accident, they must file the corresponding police report.",
    ],
    photoConsent:
      "By signing this contract, the customer approves the use of photographs that MDZ Rent a Car may take of it for the company's advertising purposes.",
    jurisdiction:
      "For any dispute arising from this contract, the parties submit to the first judicial district of the Province of Mendoza, waiving any other jurisdiction.",
    acceptance:
      "The CUSTOMER hereby undertakes to comply with all the rules specified in this agreement.",
  },
  email: {
    handoverSubject: "Your vehicle handover report — MDZ Rent a Car",
    returnSubject: "Your vehicle return report — MDZ Rent a Car",
    greeting: "Hello",
    handoverBody:
      "Please find attached the vehicle handover report with the rental conditions, the recorded condition and your signature.",
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
