import type { Metadata } from "next";
import type { EmailSettings } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { ButtonLink } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextField, TextareaField } from "@/components/ui/fields";
import { SavedBanner } from "@/components/ui/saved-banner";
import { SectionHeading } from "@/components/ui/section-heading";
import { SubsectionTitle } from "@/components/ui/subsection-title";
import { getDictionary } from "@/lib/i18n";
import { saveEmailSettings } from "../actions";

export const metadata: Metadata = { title: "Correos electrónicos — Andes" };

/** Bloque de campos para un idioma. Los placeholders muestran el texto por defecto. */
function LocaleFields({
  prefix,
  settings,
  defaults,
}: {
  prefix: "es" | "en";
  settings: EmailSettings | null;
  defaults: ReturnType<typeof getDictionary>["email"];
}) {
  const val = (key: keyof EmailSettings) =>
    (settings?.[key] as string | null | undefined) ?? undefined;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4">
        <SubsectionTitle>Correo de entrega</SubsectionTitle>
        <TextField
          id={`${prefix}HandoverSubject`}
          label="Asunto"
          defaultValue={val(`${prefix}HandoverSubject` as keyof EmailSettings)}
          placeholder={defaults.handoverSubject}
        />
        <TextareaField
          id={`${prefix}HandoverBody`}
          label="Cuerpo"
          defaultValue={val(`${prefix}HandoverBody` as keyof EmailSettings)}
          placeholder={defaults.handoverBody}
        />
      </div>

      <div className="flex flex-col gap-4 border-t border-foreground/10 pt-5">
        <SubsectionTitle>Correo de devolución</SubsectionTitle>
        <TextField
          id={`${prefix}ReturnSubject`}
          label="Asunto"
          defaultValue={val(`${prefix}ReturnSubject` as keyof EmailSettings)}
          placeholder={defaults.returnSubject}
        />
        <TextareaField
          id={`${prefix}ReturnBody`}
          label="Cuerpo"
          defaultValue={val(`${prefix}ReturnBody` as keyof EmailSettings)}
          placeholder={defaults.returnBody}
        />
      </div>

      <div className="flex flex-col gap-4 border-t border-foreground/10 pt-5">
        <SubsectionTitle>Textos comunes</SubsectionTitle>
        <TextField
          id={`${prefix}Greeting`}
          label="Saludo"
          hint="Se antepone al nombre del cliente. Ej: «Hola Juan,»"
          defaultValue={val(`${prefix}Greeting` as keyof EmailSettings)}
          placeholder={defaults.greeting}
        />
        <TextField
          id={`${prefix}AttachmentNote`}
          label="Nota del adjunto"
          defaultValue={val(`${prefix}AttachmentNote` as keyof EmailSettings)}
          placeholder={defaults.attachmentNote}
        />
        <TextareaField
          id={`${prefix}Regards`}
          label="Firma / despedida"
          defaultValue={val(`${prefix}Regards` as keyof EmailSettings)}
          placeholder={defaults.regards}
        />
      </div>
    </div>
  );
}

export default async function EmailSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireAdmin();
  const { saved } = await searchParams;

  const settings = await prisma.emailSettings.findUnique({ where: { id: 1 } });
  const esDefaults = getDictionary("es").email;
  const enDefaults = getDictionary("en").email;

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Correos electrónicos</h1>
        <p className="text-sm text-foreground/60">
          Textos de los correos que recibe el cliente al confirmar una entrega o devolución.
          Dejá un campo vacío para usar el texto por defecto (visible como sugerencia).
        </p>
      </div>

      <SavedBanner show={saved === "1"} label="Correos guardados." />

      <form action={saveEmailSettings} className="flex flex-col gap-8">
        {/* Remitente */}
        <section className="flex flex-col gap-3">
          <SectionHeading>Remitente</SectionHeading>
          <TextField
            id="fromAddress"
            label="Casilla desde donde salen los correos"
            type="text"
            hint='Ej: MDZ Rent a Car <info@mdzrentacar.com>. Vacío usa la configuración del servidor.'
            defaultValue={settings?.fromAddress ?? undefined}
            placeholder="info@mdzrentacar.com"
          />
        </section>

        {/* Español */}
        <section className="flex flex-col gap-4">
          <SectionHeading>Textos en español</SectionHeading>
          <LocaleFields prefix="es" settings={settings} defaults={esDefaults} />
        </section>

        {/* Inglés */}
        <section className="flex flex-col gap-4">
          <SectionHeading description="Se usan solo en alquileres marcados en inglés.">
            Textos en inglés
          </SectionHeading>
          <LocaleFields prefix="en" settings={settings} defaults={enDefaults} />
        </section>

        <div className="flex items-center justify-between">
          <ButtonLink href="/settings" variant="secondary">Volver</ButtonLink>
          <SubmitButton pendingLabel="Guardando…">Guardar</SubmitButton>
        </div>
      </form>
    </div>
  );
}
