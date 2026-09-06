import "server-only";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/encryption";
import type { ChakraAccount } from "@/lib/whatsapp/chakra";

/** Configuración cruda (con los campos cifrados intactos) para mostrar en Configuración. */
export async function getWhatsAppSettings() {
  return prisma.whatsAppSettings.findUnique({ where: { id: 1 } });
}

export async function saveWhatsAppSettings(input: {
  wabaId: string;
  phoneNumberId: string;
  pluginId: string;
  accessToken?: string; // vacío = conservar el actual (no se reimprime en el form)
  webhookSecret?: string;
}) {
  const existing = await prisma.whatsAppSettings.findUnique({ where: { id: 1 } });

  const accessTokenEnc = input.accessToken ? encrypt(input.accessToken) : existing?.accessTokenEnc;
  if (!accessTokenEnc) throw new Error("Falta el access token.");
  const webhookSecretEnc = input.webhookSecret ? encrypt(input.webhookSecret) : existing?.webhookSecretEnc;

  return prisma.whatsAppSettings.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      wabaId: input.wabaId,
      phoneNumberId: input.phoneNumberId,
      pluginId: input.pluginId,
      accessTokenEnc,
      webhookSecretEnc,
    },
    update: {
      wabaId: input.wabaId,
      phoneNumberId: input.phoneNumberId,
      pluginId: input.pluginId,
      accessTokenEnc,
      webhookSecretEnc,
    },
  });
}

/** Cuenta lista para pegarle a Chakra (token descifrado). Null si no hay nada conectado. */
export async function getDecryptedAccount(): Promise<ChakraAccount | null> {
  const settings = await getWhatsAppSettings();
  if (!settings) return null;
  return {
    phoneNumberId: settings.phoneNumberId,
    pluginId: settings.pluginId,
    accessToken: decrypt(settings.accessTokenEnc),
  };
}

/** Secreto para verificar la firma del webhook. Null si no está configurado. */
export async function getDecryptedWebhookSecret(): Promise<string | null> {
  const settings = await getWhatsAppSettings();
  if (!settings?.webhookSecretEnc) return null;
  return decrypt(settings.webhookSecretEnc);
}
