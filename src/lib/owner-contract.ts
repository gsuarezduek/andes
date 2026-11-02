/**
 * Contrato de cesión entre MDZ Rent a Car y el dueño de un auto de tercero.
 * Lógica pura, sin `server-only`: la usan el wizard (cliente), las acciones y el
 * PDF (servidor). Los textos viven acá y son solo en español: es un documento
 * legal que hoy se firma únicamente en ese idioma.
 */

import { splitParagraphs } from "@/lib/contract-text";

export const OWNER_CONTRACT_DOC_TITLE = "Condiciones de cesión de uso y estado del vehículo";

/**
 * Texto original del sistema: rige mientras no se guardó ninguna versión en
 * Configuración y es el que firmaron los contratos con `versionId` null, así que
 * NO se edita (cambiaría el PDF de esos contratos). Se cambia desde Configuración.
 *
 * Formato: bloques separados por una línea en blanco. Un bloque en mayúsculas es
 * un título; las líneas que empiezan con "- " son una lista.
 */
export const ORIGINAL_OWNER_CONTRACT_TEXT = {
  title: "Contrato de cesión de vehículo para alquiler",
  body: `TITULARIDAD
El PROPIETARIO declara ser único titular o legítimo poseedor del vehículo, el cual se encuentra libre de embargos, prendas, inhibiciones o cualquier otra restricción que impida su uso comercial.

RENOVACIÓN
La cesión podrá renovarse mediante acuerdo expreso entre las partes, que se instrumentará en un nuevo contrato.

CONDICIONES DE USO Y DESTINO
El vehículo será destinado exclusivamente al alquiler a terceros, bajo las condiciones comerciales y contractuales habituales de MDZ RENT A CAR.

MDZ RENT A CAR se compromete a:
- Alquilar el vehículo únicamente a clientes que suscriban contrato de alquiler vigente.
- Exigir la documentación habilitante correspondiente a los conductores.
- Utilizar el vehículo conforme a su destino normal y uso responsable.

El PROPIETARIO autoriza expresamente el uso del vehículo para fines comerciales de alquiler.

SEGURO
El vehículo será asegurado conforme a la póliza contratada por el PROPIETARIO, la cual podrá incluir cobertura contra terceros, robo, hurto y/o daños, con o sin franquicia, según se pacte comercialmente. El PROPIETARIO mantendrá la póliza vigente durante todo el plazo de la cesión y avisará de inmediato a MDZ RENT A CAR cualquier cambio o baja. En caso de siniestro, ambas partes se comprometen a colaborar con la aseguradora y cumplir los procedimientos correspondientes.

RESPONSABILIDAD Y DEVOLUCIÓN
MDZ RENT A CAR se obliga a restituir el vehículo al PROPIETARIO al finalizar la cesión, en condiciones similares a las de su recepción, considerando el desgaste normal derivado del uso comercial.

Cualquier daño extraordinario será tratado conforme a las coberturas del seguro vigente y a las responsabilidades que correspondan según el origen del daño.

JURISDICCIÓN
Las partes se someten, ante cualquier conflicto derivado del presente contrato, a la competencia de la Primera Circunscripción Judicial de la Provincia de Mendoza, renunciando a cualquier otro fuero o jurisdicción.

CONFORMIDAD Y FIRMAS
Leído y ratificado, las partes firman en pantalla, en el lugar y la fecha indicados. Cada una recibe una copia en PDF, de un mismo tenor y a un solo efecto.`,
} as const;

// --- Texto ------------------------------------------------------------------

export type ClauseBlock =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; items: string[] };

function isHeadingLine(line: string): boolean {
  return /\p{L}/u.test(line) && line === line.toLocaleUpperCase("es") && !line.startsWith("- ");
}

/**
 * Pasa el cuerpo editable a bloques. Un título puede ir pegado al párrafo que le
 * sigue (sin línea en blanco), y una lista puede ir pegada al texto que la presenta.
 */
export function parseClauses(body: string): ClauseBlock[] {
  const blocks: ClauseBlock[] = [];
  for (const paragraph of splitParagraphs(body)) {
    let text: string[] = [];
    let items: string[] = [];
    const flushText = () => {
      if (text.length > 0) blocks.push({ kind: "paragraph", text: text.join("\n") });
      text = [];
    };
    const flushItems = () => {
      if (items.length > 0) blocks.push({ kind: "list", items });
      items = [];
    };
    paragraph.split("\n").forEach((line, i) => {
      if (line.startsWith("- ")) {
        flushText();
        items.push(line.slice(2).trim());
      } else if (i === 0 && isHeadingLine(line)) {
        blocks.push({ kind: "heading", text: line });
      } else {
        flushItems();
        text.push(line);
      }
    });
    flushText();
    flushItems();
  }
  return blocks;
}

/** Título y cuerpo listos para guardar, o el motivo por el que no se pueden guardar. */
export function normalizeOwnerContractText(input: { title: string; body: string }):
  | { ok: true; value: { title: string; body: string } }
  | { ok: false; error: string } {
  const title = input.title.trim();
  const paragraphs = splitParagraphs(input.body);
  if (!title) return { ok: false, error: "Falta el título." };
  if (paragraphs.length === 0) return { ok: false, error: "Falta el texto del contrato." };
  return { ok: true, value: { title, body: paragraphs.join("\n\n") } };
}

// --- Estado del vehículo al ingreso -----------------------------------------

type ChecklistItem =
  | { kind: "choice"; key: string; options: { value: string; label: string }[] }
  | { kind: "check"; key: string; label: string };

export const OWNER_CONTRACT_CHECKLIST: { title: string; items: ChecklistItem[] }[] = [
  {
    title: "Estado general",
    items: [
      {
        kind: "choice",
        key: "general",
        options: [
          { value: "excellent", label: "Excelente" },
          { value: "good", label: "Bueno" },
          { value: "regular", label: "Regular" },
        ],
      },
    ],
  },
  {
    title: "Exterior",
    items: [
      {
        kind: "choice",
        key: "body",
        options: [
          { value: "clean", label: "Sin rayones" },
          { value: "light", label: "Rayones leves" },
          { value: "dents", label: "Golpes" },
        ],
      },
      {
        kind: "choice",
        key: "windshield",
        options: [
          { value: "ok", label: "Parabrisas en buen estado" },
          { value: "damaged", label: "Astillado / Rajado" },
        ],
      },
    ],
  },
  {
    title: "Interior",
    items: [
      {
        kind: "choice",
        key: "upholstery",
        options: [
          { value: "ok", label: "Tapizados en buen estado" },
          { value: "damaged", label: "Manchas / Roturas" },
        ],
      },
      { kind: "check", key: "dashboard", label: "Tablero e instrumental correctos" },
    ],
  },
  {
    title: "Mecánica básica",
    items: [
      { kind: "check", key: "start", label: "Arranque correcto" },
      { kind: "check", key: "lights", label: "Luces operativas" },
      { kind: "check", key: "tires", label: "Neumáticos en buen estado" },
      { kind: "check", key: "spare", label: "Rueda de auxilio" },
    ],
  },
  {
    title: "Accesorios y documentación",
    items: [
      { kind: "check", key: "greenCard", label: "Tarjeta verde" },
      { kind: "check", key: "policy", label: "Póliza de seguro" },
      { kind: "check", key: "extinguisher", label: "Matafuego" },
      { kind: "check", key: "beacons", label: "Balizas" },
      { kind: "check", key: "jack", label: "Gato y llave de rueda" },
    ],
  },
];

/** Respuestas del checklist: opción elegida, o true/false si es una tilde. */
export type ConditionResponses = Record<string, string | boolean>;

/**
 * Estado tal como se firmó (se guarda en `OwnerContract.condition`): cada línea
 * trae sus opciones con la marcada, así el PDF no depende de cómo cambie después
 * la definición de arriba.
 */
export type ConditionGroup = {
  title: string;
  lines: { label: string; selected: boolean }[][];
};

export function missingConditionCount(responses: ConditionResponses): number {
  let missing = 0;
  for (const group of OWNER_CONTRACT_CHECKLIST) {
    for (const item of group.items) {
      if (item.kind === "choice" && !item.options.some((o) => o.value === responses[item.key])) missing += 1;
    }
  }
  return missing;
}

export function buildConditionSnapshot(responses: ConditionResponses): ConditionGroup[] {
  return OWNER_CONTRACT_CHECKLIST.map((group) => ({
    title: group.title,
    lines: group.items.map((item) =>
      item.kind === "choice"
        ? item.options.map((o) => ({ label: o.label, selected: responses[item.key] === o.value }))
        : [{ label: item.label, selected: responses[item.key] === true }],
    ),
  }));
}

// --- Vigencia ---------------------------------------------------------------

export type OwnerContractStatus = "voided" | "upcoming" | "active" | "expired";

export function ownerContractStatus(
  c: { startsAt: Date; endsAt: Date; voidedAt: Date | null },
  now: Date,
): OwnerContractStatus {
  if (c.voidedAt) return "voided";
  if (now < c.startsAt) return "upcoming";
  return now < c.endsAt ? "active" : "expired";
}

export const OWNER_CONTRACT_STATUS: Record<
  OwnerContractStatus,
  { label: string; tone: "emerald" | "blue" | "neutral" | "red" }
> = {
  active: { label: "Vigente", tone: "emerald" },
  upcoming: { label: "Todavía no empezó", tone: "blue" },
  expired: { label: "Vencido", tone: "neutral" },
  voided: { label: "Dado de baja", tone: "red" },
};

/** Contrato vigente que termina más tarde (puede haber dos si se renovó antes de tiempo). */
export function currentOwnerContract<T extends { startsAt: Date; endsAt: Date; voidedAt: Date | null }>(
  contracts: T[],
  now: Date,
): T | null {
  return contracts
    .filter((c) => ownerContractStatus(c, now) === "active")
    .reduce<T | null>((best, c) => (!best || c.endsAt > best.endsAt ? c : best), null);
}

// --- Borrador del wizard ----------------------------------------------------

export const OWNER_CONTRACT_STEPS = ["Propietario", "Plazo", "Estado", "Firma MDZ", "Firma propietario"] as const;

export type OwnerContractDraft = {
  ownerName: string;
  ownerDocNumber: string;
  ownerAddress: string;
  ownerEmail: string;
  ownerPhone: string;
  place: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  commercialTerms: string;
  km: string;
  fuelLevel: number;
  responses: ConditionResponses;
  observations: string;
  companySignerName: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Qué falta para avanzar del paso indicado; null si se puede seguir. Las firmas
 * las valida el wizard (viven en el canvas). El servidor vuelve a llamar a esto
 * con todos los pasos: nunca confía en lo que validó el cliente.
 */
export function validateOwnerContractStep(step: number, d: OwnerContractDraft): string | null {
  switch (step) {
    case 0:
      if (!d.ownerName.trim()) return "Falta el nombre del propietario.";
      if (!d.ownerDocNumber.trim()) return "Falta el documento del propietario.";
      if (!d.ownerAddress.trim()) return "Falta el domicilio del propietario.";
      if (d.ownerEmail.trim() && !EMAIL_RE.test(d.ownerEmail.trim())) return "El email no tiene un formato válido.";
      return null;
    case 1:
      if (!d.place.trim()) return "Falta el lugar.";
      if (!DATE_RE.test(d.startDate) || !TIME_RE.test(d.startTime)) return "Falta la fecha y hora de inicio.";
      if (!DATE_RE.test(d.endDate) || !TIME_RE.test(d.endTime)) return "Falta la fecha y hora de fin.";
      if (`${d.endDate}T${d.endTime}` <= `${d.startDate}T${d.startTime}`) return "El fin tiene que ser posterior al inicio.";
      return null;
    case 2: {
      if (!/^\d+$/.test(d.km.trim())) return "Falta el kilometraje.";
      const missing = missingConditionCount(d.responses);
      if (missing > 0) return `Falta completar ${missing} ${missing === 1 ? "punto" : "puntos"} del estado del vehículo.`;
      return null;
    }
    case 3:
      return d.companySignerName.trim() ? null : "Falta el nombre de quien firma por MDZ Rent a Car.";
    default:
      return null;
  }
}
