import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { ButtonLink } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextField } from "@/components/ui/fields";
import { SavedBanner } from "@/components/ui/saved-banner";
import { SectionHeading } from "@/components/ui/section-heading";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/datetime";
import { saveWhatsAppAccount } from "./actions";
import { SyncTemplatesButton } from "./sync-templates-button";

export const metadata: Metadata = { title: "WhatsApp — Andes" };

export default async function WhatsAppSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireAdmin();
  const { saved } = await searchParams;

  const [settings, templates] = await Promise.all([
    prisma.whatsAppSettings.findUnique({ where: { id: 1 } }),
    prisma.whatsAppTemplate.findMany({ orderBy: { name: "asc" } }),
  ]);

  const webhookUrl = `${env.appUrl}/api/webhooks/whatsapp`;

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">WhatsApp</h1>
        <p className="text-sm text-foreground/60">
          Conexión con Chakra (BSP hacia la WhatsApp Cloud API de Meta) para el inbox de conversaciones.
        </p>
      </div>

      <SavedBanner show={saved === "1"} label="Cuenta guardada." />

      <section className="flex flex-col gap-4">
        <SectionHeading
          description={
            settings ? `Conectada desde ${formatDateTime(settings.connectedAt)}.` : "Todavía no hay ninguna cuenta conectada."
          }
        >
          Cuenta
        </SectionHeading>
        <form action={saveWhatsAppAccount} className="flex flex-col gap-4">
          <TextField
            id="wabaId"
            label="WABA ID"
            hint="WhatsApp Business Account id, de Meta Business Manager."
            defaultValue={settings?.wabaId ?? ""}
            required
          />
          <TextField
            id="phoneNumberId"
            label="Phone Number ID"
            hint="Id del número de WhatsApp, de Meta Business Manager."
            defaultValue={settings?.phoneNumberId ?? ""}
            required
          />
          <TextField
            id="pluginId"
            label="Plugin ID de Chakra"
            hint="Id propio de Chakra para esta cuenta — lo da su dashboard."
            defaultValue={settings?.pluginId ?? ""}
            required
          />
          <TextField
            id="accessToken"
            label="Access token"
            type="password"
            hint={settings ? "Dejalo en blanco para conservar el actual." : "Token permanente que entrega Chakra."}
          />
          <TextField
            id="webhookSecret"
            label="Secreto del webhook"
            type="password"
            hint={
              settings
                ? "Dejalo en blanco para conservar el actual."
                : "El mismo que configures en el webhook de Chakra (ver abajo) — sin esto no se verifica la firma de los mensajes entrantes."
            }
          />
          <div className="flex justify-end">
            <SubmitButton pendingLabel="Guardando…">Guardar</SubmitButton>
          </div>
        </form>
      </section>

      <section className="flex flex-col gap-2 border-t border-foreground/10 pt-6">
        <SectionHeading description="Pegá esta URL en el webhook de WhatsApp del dashboard de Chakra, con el mismo secreto que cargaste arriba.">
          Webhook
        </SectionHeading>
        <code className="break-all rounded-lg bg-foreground/5 px-3 py-2 text-sm">{webhookUrl}</code>
      </section>

      <section className="flex flex-col gap-2 border-t border-foreground/10 pt-6">
        <SectionHeading description="Personalidad, reglas de seguridad, base de conocimiento y calidad de las respuestas automáticas.">
          Bot de IA
        </SectionHeading>
        <ButtonLink href="/settings/whatsapp/bot" variant="secondary" className="self-start">
          Configurar el bot →
        </ButtonLink>
      </section>

      <section className="flex flex-col gap-4 border-t border-foreground/10 pt-6">
        <SectionHeading description="La única forma de retomar una conversación pasadas las 24hs de silencio del cliente.">
          Plantillas
        </SectionHeading>
        <SyncTemplatesButton />
        {templates.length === 0 ? (
          <p className="text-sm text-foreground/50">Todavía no se sincronizó ninguna.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
            {templates.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{t.name}</p>
                  <p className="text-xs text-foreground/50">
                    {t.language}
                    {t.variableCount > 0 ? ` · ${t.variableCount} variable(s)` : ""}
                  </p>
                </div>
                <Badge tone={t.status === "APPROVED" ? "emerald" : t.status === "REJECTED" ? "red" : "amber"}>
                  {t.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div>
        <ButtonLink href="/settings" variant="secondary">
          Volver
        </ButtonLink>
      </div>
    </div>
  );
}
