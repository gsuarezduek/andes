"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-helpers";
import { displayName } from "@/lib/user-display";
import { prisma } from "@/lib/prisma";
import { sendTextMessage, sendMediaMessage, reopenWithTemplate } from "@/lib/whatsapp/send";
import { sniffBinaryType } from "@/lib/whatsapp/attachment-kind";
import {
  setConversationRental,
  setConversationPinned,
  setPendingConfirmation,
  setFollowUp,
  setConfirmed,
  setTransferred,
} from "@/lib/whatsapp/conversations";

export type MessageActionState = { error?: string };

const MAX_ATTACHMENT_BYTES = 16 * 1024 * 1024; // 16 MB — generoso para fotos/documentos, Meta valida el resto

/**
 * Ligado con `.bind(null, conversationId)` desde el form (contrato de
 * `useActionState`). Si el form trae un archivo (campo "file", ver
 * SendForm), manda la foto/video/documento con el texto como caption; si no,
 * manda el texto solo — un único form y una única action para los dos casos.
 */
export async function sendMessage(
  conversationId: string,
  _prev: MessageActionState,
  formData: FormData,
): Promise<MessageActionState> {
  const user = await requireUser();
  const text = String(formData.get("text") ?? "").trim();
  const file = formData.get("file");

  try {
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_ATTACHMENT_BYTES) return { error: "El archivo es demasiado grande (máximo 16 MB)." };
      const buffer = Buffer.from(await file.arrayBuffer());
      const mimeType = sniffBinaryType(buffer) ?? file.type ?? "application/octet-stream";
      await sendMediaMessage(conversationId, { buffer, mimeType, filename: file.name || "archivo" }, text || undefined, user.id, displayName(user));
    } else {
      if (!text) return { error: "Escribí un mensaje." };
      await sendTextMessage(conversationId, text, user.id, displayName(user));
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo enviar el mensaje." };
  }
  revalidatePath(`/whatsapp/${conversationId}`);
  revalidatePath("/whatsapp");
  return {};
}

/** Una variable por línea, en el mismo orden que espera la plantilla. */
export async function reopenConversation(
  conversationId: string,
  _prev: MessageActionState,
  formData: FormData,
): Promise<MessageActionState> {
  const user = await requireUser();
  const templateId = String(formData.get("templateId") ?? "");
  if (!templateId) return { error: "Elegí una plantilla." };
  const variables = String(formData.get("variables") ?? "")
    .split("\n")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);

  try {
    await reopenWithTemplate(conversationId, templateId, variables, user.id, displayName(user));
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo mandar la plantilla." };
  }
  revalidatePath(`/whatsapp/${conversationId}`);
  revalidatePath("/whatsapp");
  return {};
}

/**
 * Al reactivar el bot a mano ("Devolver al bot"), también limpia
 * `transferredAt` — reactivarlo es la forma más directa de decir "esto ya
 * no necesita seguir marcado como Transferido", aunque nadie haya mandado
 * un mensaje todavía.
 */
export async function toggleConversationBot(conversationId: string, botEnabled: boolean) {
  await requireUser();
  await prisma.whatsAppConversation.update({
    where: { id: conversationId },
    data: botEnabled ? { botEnabled, transferredAt: null } : { botEnabled },
  });
  revalidatePath(`/whatsapp/${conversationId}`);
}

/** Fijar/quitar fijado — propio de Andes, compartido para todo el equipo (no por usuario). */
export async function toggleConversationPinned(conversationId: string, pinned: boolean) {
  await requireUser();
  await setConversationPinned(conversationId, pinned);
  revalidatePath(`/whatsapp/${conversationId}`);
  revalidatePath("/whatsapp");
}

/** Marca/descarta "A confirmar" a mano — el bot lo prende solo (ver whatsapp/bot/respond.ts), esto es el escape manual. */
export async function toggleConversationConfirm(conversationId: string, on: boolean) {
  await requireUser();
  await setPendingConfirmation(conversationId, on);
  revalidatePath(`/whatsapp/${conversationId}`);
  revalidatePath("/whatsapp");
}

/** Marca/descarta "A recuperar" a mano. */
export async function toggleConversationFollowUp(conversationId: string, on: boolean) {
  await requireUser();
  await setFollowUp(conversationId, on);
  revalidatePath(`/whatsapp/${conversationId}`);
  revalidatePath("/whatsapp");
}

/** Marca/descarta "Confirmado" a mano — nunca lo prende el bot (ver setConfirmed). */
export async function toggleConversationConfirmed(conversationId: string, on: boolean) {
  await requireUser();
  await setConfirmed(conversationId, on);
  revalidatePath(`/whatsapp/${conversationId}`);
  revalidatePath("/whatsapp");
}

/** Marca/descarta "Transferido" a mano — el bot lo prende solo al escalar (ver whatsapp/bot/respond.ts). */
export async function toggleConversationTransferred(conversationId: string, on: boolean) {
  await requireUser();
  await setTransferred(conversationId, on);
  revalidatePath(`/whatsapp/${conversationId}`);
  revalidatePath("/whatsapp");
}

/** Vincula (o desvincula, `rentalId: null`) la conversación a una reserva. Ligado con `.bind()` desde botones y el buscador. */
export async function linkRental(conversationId: string, rentalId: string | null) {
  await requireUser();
  await setConversationRental(conversationId, rentalId);
  revalidatePath(`/whatsapp/${conversationId}`);
}

/**
 * IDs de conversaciones con al menos un mensaje que contiene `query` — para
 * sumar al buscador del listado (`ConversationList`), que filtra nombre/
 * teléfono en el navegador pero no tiene el texto de los mensajes cargado.
 * Se corta en 2 caracteres para no hacer un `contains` disparado por cada
 * tecla de una búsqueda de una sola letra.
 */
export async function searchConversationIdsByMessage(query: string): Promise<string[]> {
  await requireUser();
  const q = query.trim();
  if (q.length < 2) return [];
  const matches = await prisma.whatsAppConversation.findMany({
    where: { messages: { some: { body: { contains: q, mode: "insensitive" } } } },
    select: { id: true },
    take: 50,
  });
  return matches.map((m) => m.id);
}

export async function updateCustomer(customerId: string, conversationId: string, formData: FormData) {
  await requireUser();
  const name = String(formData.get("name") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  await prisma.customer.update({ where: { id: customerId }, data: { name, email } });
  revalidatePath(`/whatsapp/${conversationId}`);
}
