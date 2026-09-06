"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { sendTextMessage, reopenWithTemplate } from "@/lib/whatsapp/send";

export type MessageActionState = { error?: string };

/** Ligado con `.bind(null, conversationId)` desde el form (contrato de `useActionState`). */
export async function sendMessage(
  conversationId: string,
  _prev: MessageActionState,
  formData: FormData,
): Promise<MessageActionState> {
  const user = await requireUser();
  const text = String(formData.get("text") ?? "").trim();
  if (!text) return { error: "Escribí un mensaje." };

  try {
    await sendTextMessage(conversationId, text, user.id);
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
    await reopenWithTemplate(conversationId, templateId, variables, user.id);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo mandar la plantilla." };
  }
  revalidatePath(`/whatsapp/${conversationId}`);
  revalidatePath("/whatsapp");
  return {};
}

export async function assignConversation(conversationId: string, formData: FormData) {
  await requireUser();
  const assignedToId = String(formData.get("assignedToId") ?? "").trim() || null;
  await prisma.whatsAppConversation.update({ where: { id: conversationId }, data: { assignedToId } });
  revalidatePath(`/whatsapp/${conversationId}`);
  revalidatePath("/whatsapp");
}

export async function updateCustomer(customerId: string, conversationId: string, formData: FormData) {
  await requireUser();
  const name = String(formData.get("name") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  await prisma.customer.update({ where: { id: customerId }, data: { name, email } });
  revalidatePath(`/whatsapp/${conversationId}`);
}
