import { getDictionary, type Locale } from "@/lib/i18n";

/**
 * Condiciones generales del contrato que firma el cliente, en un idioma: un
 * título y las cláusulas en orden. Puro y sin `server-only` a propósito — lo
 * usan el acta (servidor), el wizard y la pantalla de firma remota (cliente).
 *
 * En la base (`ContractVersion`) cada idioma se guarda como título + cuerpo en
 * texto plano, con las cláusulas separadas por una línea en blanco: es lo que
 * edita el admin en Configuración → Contrato.
 */
export type ContractText = { title: string; paragraphs: string[] };
export type ContractTexts = Record<Locale, ContractText>;

/** Contrato a mostrar/firmar: la versión (null = texto original del sistema) y sus textos. */
export type ResolvedContract = { versionId: string | null; texts: ContractTexts };

/** Fila de `ContractVersion` (o el subconjunto que hace falta para leerla). */
export type ContractVersionFields = {
  esTitle: string;
  esBody: string;
  enTitle: string;
  enBody: string;
};

/**
 * Texto original del sistema (diccionario i18n `legal`). Rige mientras no se
 * guardó ninguna versión, y es el que firmaron todas las inspecciones con
 * `contractVersionId` null — por eso el diccionario NO se edita más: cambiarlo
 * cambiaría retroactivamente el acta regenerada de esas inspecciones.
 */
export function defaultContractText(locale: Locale): ContractText {
  const legal = getDictionary(locale).legal;
  return {
    title: legal.title,
    paragraphs: [...legal.paragraphs, legal.photoConsent, legal.jurisdiction, legal.acceptance],
  };
}

export function defaultContractTexts(): ContractTexts {
  return { es: defaultContractText("es"), en: defaultContractText("en") };
}

/**
 * Parte el cuerpo en cláusulas: una o más líneas en blanco separan cláusulas;
 * los saltos de línea simples dentro de una cláusula se respetan. Recorta
 * espacios y descarta cláusulas vacías. Acepta CRLF (pegado desde Word).
 */
export function splitParagraphs(body: string): string[] {
  return body
    .replace(/\r\n?/g, "\n")
    .split(/\n[ \t]*\n/)
    .map((p) =>
      p
        .split("\n")
        .map((line) => line.trim())
        .join("\n")
        .trim(),
    )
    .filter((p) => p !== "");
}

/** Inverso de `splitParagraphs`: arma el cuerpo editable a partir de las cláusulas. */
export function joinParagraphs(paragraphs: string[]): string {
  return paragraphs.join("\n\n");
}

export function contractTextsFromVersion(v: ContractVersionFields): ContractTexts {
  return {
    es: { title: v.esTitle.trim(), paragraphs: splitParagraphs(v.esBody) },
    en: { title: v.enTitle.trim(), paragraphs: splitParagraphs(v.enBody) },
  };
}

/**
 * Normaliza lo que mandó el formulario y lo valida. Devuelve los campos listos
 * para guardar (cuerpos re-armados con un único separador entre cláusulas, así
 * dos textos que solo difieren en espacios cuentan como iguales).
 */
export function normalizeContractInput(input: ContractVersionFields):
  | { ok: true; value: ContractVersionFields }
  | { ok: false; error: string } {
  const es = { title: input.esTitle.trim(), paragraphs: splitParagraphs(input.esBody) };
  const en = { title: input.enTitle.trim(), paragraphs: splitParagraphs(input.enBody) };
  if (!es.title) return { ok: false, error: "Falta el título en español." };
  if (es.paragraphs.length === 0) return { ok: false, error: "Falta el texto del contrato en español." };
  if (!en.title) return { ok: false, error: "Falta el título en inglés." };
  if (en.paragraphs.length === 0) return { ok: false, error: "Falta el texto del contrato en inglés." };
  return {
    ok: true,
    value: {
      esTitle: es.title,
      esBody: joinParagraphs(es.paragraphs),
      enTitle: en.title,
      enBody: joinParagraphs(en.paragraphs),
    },
  };
}

/** True si dos contratos (ya normalizados) dicen exactamente lo mismo. */
export function sameContract(a: ContractVersionFields, b: ContractVersionFields): boolean {
  return a.esTitle === b.esTitle && a.esBody === b.esBody && a.enTitle === b.enTitle && a.enBody === b.enBody;
}

/** El texto original del sistema expresado como campos de `ContractVersion`. */
export function defaultContractFields(): ContractVersionFields {
  const d = defaultContractTexts();
  return {
    esTitle: d.es.title,
    esBody: joinParagraphs(d.es.paragraphs),
    enTitle: d.en.title,
    enBody: joinParagraphs(d.en.paragraphs),
  };
}
