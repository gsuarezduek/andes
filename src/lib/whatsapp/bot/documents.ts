/**
 * Base de conocimiento del bot: sube PDF/DOCX/TXT, extrae el texto una sola
 * vez (no en cada mensaje) y lo deja listo para inyectar al prompt. Sin
 * resumen si entra en el tope; con IA si es más largo, para no perder
 * información recortando a lo bruto a mitad de una oración.
 */
import "server-only";
import { randomUUID } from "node:crypto";
import { storage } from "@/lib/storage";
import { prisma } from "@/lib/prisma";
import { client, MODEL } from "@/lib/competitor-prices/llm";

export const MAX_DOCUMENTS = 5;
export const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_CHARS_PER_DOC = 20_000;
const MAX_SUMMARY_INPUT_CHARS = 100_000;

type DetectedType = "pdf" | "docx" | "txt" | null;

/** PDF por firma `%PDF-`; DOCX por firma ZIP (no se distingue de un ZIP genérico
 *  por magic bytes — que `mammoth` pueda extraerle texto es la validación real). */
function detectType(buffer: Buffer): DetectedType {
  if (buffer.length >= 5 && buffer.toString("ascii", 0, 5) === "%PDF-") return "pdf";
  if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
    return "docx";
  }
  return "txt";
}

async function extractRawText(buffer: Buffer, type: DetectedType): Promise<string> {
  if (type === "pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: buffer });
    try {
      // `result.text` intercala separadores de página; concatenar `pages[].text`
      // da el texto limpio.
      const result = await parser.getText();
      return result.pages.map((p) => p.text).join("\n\n");
    } finally {
      await parser.destroy();
    }
  }
  if (type === "docx") {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  return buffer.toString("utf8");
}

/** Resumen con IA, acotado al mismo tope que un documento normal. */
async function summarizeText(text: string): Promise<string> {
  const msg = await client().messages.create({
    model: MODEL,
    max_tokens: 4096,
    tools: [
      {
        name: "summarize",
        description: `Resume el documento en como máximo ${MAX_CHARS_PER_DOC} caracteres, preservando servicios, precios, políticas, horarios y preguntas frecuentes — es la base de conocimiento de un bot que responde clientes por WhatsApp.`,
        input_schema: {
          type: "object",
          properties: { summary: { type: "string" } },
          required: ["summary"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "summarize" },
    messages: [{ role: "user", content: text.slice(0, MAX_SUMMARY_INPUT_CHARS) }],
  });
  const toolUse = msg.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") throw new Error("El modelo no devolvió un resumen.");
  return (toolUse.input as { summary: string }).summary;
}

/** Función pura: decide el texto final + los flags a partir del crudo y (opcional) el resumen. */
export function buildTextResult(
  raw: string,
  summary: string | null,
): { text: string; truncated: boolean; summarized: boolean } {
  if (raw.length <= MAX_CHARS_PER_DOC) return { text: raw, truncated: false, summarized: false };
  if (summary && summary.length <= MAX_CHARS_PER_DOC) return { text: summary, truncated: false, summarized: true };
  // Sin resumen, o el resumen en sí se pasó del tope: se cae al truncado crudo.
  const fallback = summary ?? raw;
  return { text: fallback.slice(0, MAX_CHARS_PER_DOC), truncated: true, summarized: Boolean(summary) };
}

export async function uploadDocument(file: File) {
  const count = await prisma.whatsAppBotDocument.count();
  if (count >= MAX_DOCUMENTS) {
    throw new Error(`Ya hay ${MAX_DOCUMENTS} documentos cargados — borrá alguno antes de subir otro.`);
  }
  if (file.size === 0 || file.size > MAX_SIZE_BYTES) {
    throw new Error("El archivo debe pesar entre 1 byte y 10 MB.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const type = detectType(buffer);

  let raw: string;
  try {
    raw = await extractRawText(buffer, type);
  } catch {
    throw new Error("No se pudo leer el archivo — ¿es realmente un PDF, DOCX o TXT válido?");
  }
  if (!raw.trim()) throw new Error("No se encontró texto en el archivo.");

  let summary: string | null = null;
  if (raw.length > MAX_CHARS_PER_DOC) {
    summary = await summarizeText(raw).catch(() => null);
  }
  const { text, truncated, summarized } = buildTextResult(raw, summary);

  const id = randomUUID();
  const mimeType = type === "pdf" ? "application/pdf" : type === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "text/plain";
  const ext = type === "pdf" ? "pdf" : type === "docx" ? "docx" : "txt";
  const key = `whatsapp-bot-docs/${id}.${ext}`;
  await storage().put(key, buffer, mimeType);

  return prisma.whatsAppBotDocument.create({
    data: {
      id,
      fileName: file.name || `documento.${ext}`,
      mimeType,
      sizeBytes: buffer.length,
      storageKey: key,
      extractedText: text,
      truncated,
      summarized,
    },
  });
}
