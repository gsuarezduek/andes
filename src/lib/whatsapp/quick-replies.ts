import "server-only";
import { prisma } from "@/lib/prisma";

export type QuickReplyOption = { id: string; shortcut: string; text: string };

/** Todas las plantillas rápidas — la lista suele ser chica (unas pocas decenas), se trae completa. */
export async function listQuickReplies(): Promise<QuickReplyOption[]> {
  return prisma.whatsAppQuickReply.findMany({
    orderBy: { shortcut: "asc" },
    select: { id: true, shortcut: true, text: true },
  });
}
