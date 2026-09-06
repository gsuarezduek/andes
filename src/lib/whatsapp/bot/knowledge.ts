import "server-only";
import { prisma } from "@/lib/prisma";

const MAX_KNOWLEDGE_CHARS = 40_000;

/** Concatena el texto extraído de todos los documentos, con tope agregado. */
export async function buildKnowledgeBlock(): Promise<string | null> {
  const documents = await prisma.whatsAppBotDocument.findMany({
    orderBy: { createdAt: "asc" },
    select: { fileName: true, extractedText: true },
  });
  if (documents.length === 0) return null;

  let block = "";
  for (const doc of documents) {
    const chunk = `### ${doc.fileName}\n${doc.extractedText}\n\n`;
    if (block.length + chunk.length > MAX_KNOWLEDGE_CHARS) break;
    block += chunk;
  }
  return block.trim() || null;
}
