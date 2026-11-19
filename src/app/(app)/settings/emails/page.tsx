import type { Metadata } from "next";
import type { ReactNode } from "react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { ButtonLink } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextField } from "@/components/ui/fields";
import { SavedBanner } from "@/components/ui/saved-banner";
import { SectionHeading } from "@/components/ui/section-heading";
import { Badge } from "@/components/ui/badge";
import { getDictionary, type Locale } from "@/lib/i18n";
import { getMonthlyReportRecipients } from "@/lib/email/settings";
import { CheckCard, MonthlyReportField } from "@/components/settings/emails/monthly-report-field";
import { EmailTextsEditor } from "@/components/settings/emails/email-texts-editor";
import { saveEmailSettings } from "../actions";

export const metadata: Metadata = { title: "Correos electrónicos — Andes" };

const TEXT_KEYS = [
  "handoverSubject",
  "returnSubject",
  "greeting",
  "handoverBody",
  "returnBody",
  "attachmentNote",
  "regards",
] as const;

export default async function EmailSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  await requireAdmin();
  const { saved } = await searchParams;

  const [settings, conditions, users, monthly] = await Promise.all([
    prisma.emailSettings.findUnique({ where: { id: 1 } }),
    prisma.conditionSettings.findUnique({
      where: { id: 1 },
      select: { sendHandoverActa: true, sendReturnActa: true },
    }),
    prisma.user.findMany({
      where: { active: true },
      select: { name: true, email: true, role: true, owner: true, active: true },
      orderBy: { name: "asc" },
    }),
    getMonthlyReportRecipients(),
  ]);

  const adminEmail = process.env.ADMIN_EMAIL?.trim() || null;
  const fromAddress = settings?.fromAddress?.trim() || null;
  const serverFrom = process.env.EMAIL_FROM?.trim() || null;
  const sendHandover = conditions?.sendHandoverActa ?? true;
  const sendReturn = conditions?.sendReturnActa ?? true;

  const textValues = Object.fromEntries(
    (["es", "en"] as const).map((locale) => [
      locale,
      Object.fromEntries(
        TEXT_KEYS.map((k) => {
          const col = `${locale}${k[0].toUpperCase()}${k.slice(1)}` as keyof NonNullable<typeof settings>;
          return [k, (settings?.[col] as string | null | undefined) ?? ""];
        }),
      ),
    ]),
  ) as Record<Locale, Record<(typeof TEXT_KEYS)[number], string>>;

  const adminLabel = adminEmail ?? "sin configurar";
  const monthlyLabel =
    monthly.recipients.length === 0 ? "nadie" : monthly.recipients.map((r) => r.name).join(", ");

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-10">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Correos electrónicos</h1>
        <p className="text-sm text-foreground/60">
          Quién recibe cada correo que manda Andes, desde qué casilla sale y qué dice el correo de las actas.
        </p>
      </div>

      <SavedBanner show={saved === "1"} label="Correos guardados." />

      {/* Resumen: lo guardado hoy, de un vistazo */}
      <section className="flex flex-col gap-3">
        <SectionHeading description="Así está configurado ahora. Se actualiza al guardar.">
          Quién recibe qué
        </SectionHeading>
        <ul className="divide-y divide-foreground/10 rounded-xl border border-foreground/10">
          <SummaryRow title="Acta de entrega" when="Al confirmar una entrega">
            <Recipient on={sendHandover}>Cliente</Recipient>
            <Recipient on>Administración</Recipient>
          </SummaryRow>
          <SummaryRow title="Acta de devolución" when="Al confirmar una devolución">
            <Recipient on={sendReturn}>Cliente</Recipient>
            <Recipient on>Administración</Recipient>
          </SummaryRow>
          <SummaryRow title="Informe mensual" when="Botón en Reportes, con un mes cerrado">
            <span className="text-sm">{monthlyLabel}</span>
          </SummaryRow>
          <SummaryRow title="Resumen diario de alertas" when="Devoluciones y services vencidos">
            <Recipient on>Administración</Recipient>
          </SummaryRow>
          <SummaryRow title="Contrato de cesión" when="Al firmarlo con el dueño de un auto de terceros">
            <Recipient on>Dueño del auto</Recipient>
            <Recipient on>Administración</Recipient>
          </SummaryRow>
        </ul>
        <p className="text-xs text-foreground/50">
          &quot;Administración&quot; es la casilla <span className="font-medium">{adminLabel}</span> (ver abajo).
        </p>
      </section>

      <form action={saveEmailSettings} className="flex flex-col gap-10">
        {/* Casillas */}
        <section className="flex flex-col gap-4">
          <SectionHeading>Casillas</SectionHeading>

          <div className="flex flex-col gap-2 rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Casilla de administración</p>
              <Badge>Solo lectura</Badge>
            </div>
            {adminEmail ? (
              <p className="break-all font-mono text-base">{adminEmail}</p>
            ) : (
              <p className="text-sm font-medium text-red-600">
                Sin configurar: las copias para administración no se están enviando.
              </p>
            )}
            <p className="text-xs text-foreground/50">
              Recibe siempre una copia de cada acta, el resumen diario de alertas y los contratos de cesión. No se cambia
              desde acá: es la variable <code>ADMIN_EMAIL</code> del servidor (Railway).
            </p>
          </div>

          <TextField
            id="fromAddress"
            label="Remitente (desde dónde salen los correos)"
            type="text"
            hint={`Ej: MDZ Rent a Car <info@mdzrentacar.com>. Vacío usa el del servidor${serverFrom ? `: ${serverFrom}` : ""}. Tiene que ser de un dominio verificado en Resend.`}
            defaultValue={fromAddress ?? undefined}
            placeholder={serverFrom ?? "info@mdzrentacar.com"}
          />
        </section>

        {/* Actas */}
        <section className="flex flex-col gap-4">
          <SectionHeading description="Administración recibe siempre una copia. Esto solo decide si también le llega al cliente, al email cargado en la reserva.">
            Actas al cliente
          </SectionHeading>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <CheckCard
              name="sendHandoverActa"
              defaultChecked={sendHandover}
              title="Enviar el acta de entrega"
              caption="Al confirmar la entrega del auto"
            />
            <CheckCard
              name="sendReturnActa"
              defaultChecked={sendReturn}
              title="Enviar el acta de devolución"
              caption="Al confirmar la devolución"
            />
          </div>
        </section>

        {/* Informe mensual */}
        <section className="flex flex-col gap-4">
          <SectionHeading description='Se manda desde Reportes, con el botón "Generar y enviar" de un mes cerrado. Le llega a todos los usuarios activos de los roles elegidos.'>
            Informe mensual
          </SectionHeading>
          <MonthlyReportField users={users} initialRoles={monthly.roles} initialToOwner={monthly.toOwner} />
        </section>

        {/* Textos */}
        <section className="flex flex-col gap-4">
          <SectionHeading description="El correo que recibe el cliente con el acta adjunta. El idioma sale de cada reserva.">
            Texto del correo de las actas
          </SectionHeading>
          <EmailTextsEditor
            values={textValues}
            defaults={{ es: getDictionary("es").email, en: getDictionary("en").email }}
          />
        </section>

        <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-between gap-3 border-t border-foreground/10 bg-background/95 px-4 py-3 backdrop-blur">
          <ButtonLink href="/settings" variant="secondary">
            Volver
          </ButtonLink>
          <SubmitButton pendingLabel="Guardando…">Guardar cambios</SubmitButton>
        </div>
      </form>
    </div>
  );
}

function SummaryRow({ title, when, children }: { title: string; when: string; children: ReactNode }) {
  return (
    <li className="flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-foreground/50">{when}</p>
      </div>
      <div className="flex flex-wrap gap-1.5 sm:justify-end">{children}</div>
    </li>
  );
}

function Recipient({ on, children }: { on: boolean; children: ReactNode }) {
  return on ? (
    <Badge tone="emerald">✓ {children}</Badge>
  ) : (
    <span className="inline-flex items-center rounded-full border border-dashed border-foreground/20 px-2.5 py-0.5 text-xs text-foreground/40 line-through">
      {children}
    </span>
  );
}
