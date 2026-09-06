"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { saveWhatsAppSettings, getDecryptedAccount } from "@/lib/whatsapp/settings";
import { listTemplates } from "@/lib/whatsapp/chakra";

export async function saveWhatsAppAccount(formData: FormData) {
  await requireAdmin();
  const wabaId = String(formData.get("wabaId") ?? "").trim();
  const phoneNumberId = String(formData.get("phoneNumberId") ?? "").trim();
  const pluginId = String(formData.get("pluginId") ?? "").trim();
  const accessToken = String(formData.get("accessToken") ?? "").trim() || undefined;
  const webhookSecret = String(formData.get("webhookSecret") ?? "").trim() || undefined;

  if (!wabaId || !phoneNumberId || !pluginId) {
    throw new Error("Completá WABA ID, Phone Number ID y Plugin ID.");
  }

  await saveWhatsAppSettings({ wabaId, phoneNumberId, pluginId, accessToken, webhookSecret });
  revalidatePath("/settings/whatsapp");
  redirect("/settings/whatsapp?saved=1");
}

export type SyncTemplatesResult = { count: number } | { error: string };

/** Trae las plantillas cargadas en la WABA y las cachea localmente (upsert por externalId). */
export async function syncTemplates(): Promise<SyncTemplatesResult> {
  await requireAdmin();
  const settings = await prisma.whatsAppSettings.findUnique({ where: { id: 1 } });
  const account = await getDecryptedAccount();
  if (!settings || !account) return { error: "Conectá la cuenta primero." };

  try {
    const templates = await listTemplates({
      wabaId: settings.wabaId,
      pluginId: account.pluginId,
      accessToken: account.accessToken,
    });
    await prisma.$transaction(
      templates.map((t) =>
        prisma.whatsAppTemplate.upsert({ where: { externalId: t.externalId }, create: t, update: t }),
      ),
    );
    revalidatePath("/settings/whatsapp");
    return { count: templates.length };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "No se pudo sincronizar." };
  }
}
