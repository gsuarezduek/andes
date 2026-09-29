"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-helpers";
import { displayName } from "@/lib/user-display";
import { prisma } from "@/lib/prisma";
import { normalizeShortcut } from "@/lib/whatsapp/quick-reply-match";
import type { QuickReplyOption } from "@/lib/whatsapp/quick-replies";

export type QuickReplyActionState = { error?: string; reply?: QuickReplyOption };

const SELECT = { id: true, shortcut: true, text: true } as const;

function readFields(formData: FormData): { shortcut: string; text: string; error?: string } {
  const shortcut = normalizeShortcut(String(formData.get("shortcut") ?? ""));
  const text = String(formData.get("text") ?? "").trim();
  if (!shortcut) return { shortcut, text, error: 'Elegí un atajo (ej. "horario").' };
  if (!text) return { shortcut, text, error: "Escribí el texto de la plantilla." };
  return { shortcut, text };
}

/** Cualquiera puede crear plantillas — son de todo el equipo, mismo criterio que las notas. */
export async function createQuickReply(
  _prev: QuickReplyActionState,
  formData: FormData,
): Promise<QuickReplyActionState> {
  const user = await requireUser();
  const { shortcut, text, error } = readFields(formData);
  if (error) return { error };

  const existing = await prisma.whatsAppQuickReply.findUnique({ where: { shortcut } });
  if (existing) return { error: `Ya existe una plantilla con el atajo "/${shortcut}".` };

  const created = await prisma.whatsAppQuickReply.create({
    data: { shortcut, text, createdById: user.id, createdByName: displayName(user) },
    select: SELECT,
  });
  revalidatePath("/whatsapp");
  return { reply: created };
}

/** Ligada con `.bind(null, id)` desde el form de edición. */
export async function updateQuickReply(
  id: string,
  _prev: QuickReplyActionState,
  formData: FormData,
): Promise<QuickReplyActionState> {
  await requireUser();
  const { shortcut, text, error } = readFields(formData);
  if (error) return { error };

  const clash = await prisma.whatsAppQuickReply.findUnique({ where: { shortcut } });
  if (clash && clash.id !== id) return { error: `Ya existe una plantilla con el atajo "/${shortcut}".` };

  const updated = await prisma.whatsAppQuickReply.update({ where: { id }, data: { shortcut, text }, select: SELECT });
  revalidatePath("/whatsapp");
  return { reply: updated };
}

export async function deleteQuickReply(id: string) {
  await requireUser();
  await prisma.whatsAppQuickReply.delete({ where: { id } });
  revalidatePath("/whatsapp");
}
