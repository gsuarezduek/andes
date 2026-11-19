import "server-only";
import { prisma } from "@/lib/prisma";
import type { UserRole } from "@prisma/client";
import { getDictionary, type Dictionary, type Locale } from "@/lib/i18n";
import {
  DEFAULT_MONTHLY_REPORT_ROLES,
  DEFAULT_MONTHLY_REPORT_TO_OWNER,
  resolveMonthlyReportRecipients,
  type MonthlyReportRecipient,
} from "@/lib/email/monthly-report-recipients";

/** Devuelve el valor recortado, o el fallback si viene vacío/null. */
function pick(override: string | null | undefined, fallback: string): string {
  const s = (override ?? "").trim();
  return s === "" ? fallback : s;
}

export type ResolvedEmailConfig = {
  /** Casilla remitente configurada (override de EMAIL_FROM), o null si no hay. */
  from: string | null;
  /** Textos del correo para el locale pedido, con overlay de los overrides. */
  content: Dictionary["email"];
};

/**
 * Resuelve los textos del correo para un locale combinando los overrides
 * editables (modelo `EmailSettings`, singleton id=1) con el diccionario i18n
 * por defecto. Un campo vacío o sin configurar cae al texto del sistema.
 */
export async function resolveEmailConfig(locale: Locale): Promise<ResolvedEmailConfig> {
  const [settings, dictEmail] = await Promise.all([
    prisma.emailSettings.findUnique({ where: { id: 1 } }),
    Promise.resolve(getDictionary(locale).email),
  ]);

  const o =
    locale === "en"
      ? {
          handoverSubject: settings?.enHandoverSubject,
          returnSubject: settings?.enReturnSubject,
          greeting: settings?.enGreeting,
          handoverBody: settings?.enHandoverBody,
          returnBody: settings?.enReturnBody,
          attachmentNote: settings?.enAttachmentNote,
          regards: settings?.enRegards,
        }
      : {
          handoverSubject: settings?.esHandoverSubject,
          returnSubject: settings?.esReturnSubject,
          greeting: settings?.esGreeting,
          handoverBody: settings?.esHandoverBody,
          returnBody: settings?.esReturnBody,
          attachmentNote: settings?.esAttachmentNote,
          regards: settings?.esRegards,
        };

  return {
    from: pick(settings?.fromAddress, "") || null,
    content: {
      handoverSubject: pick(o.handoverSubject, dictEmail.handoverSubject),
      returnSubject: pick(o.returnSubject, dictEmail.returnSubject),
      greeting: pick(o.greeting, dictEmail.greeting),
      handoverBody: pick(o.handoverBody, dictEmail.handoverBody),
      returnBody: pick(o.returnBody, dictEmail.returnBody),
      attachmentNote: pick(o.attachmentNote, dictEmail.attachmentNote),
      regards: pick(o.regards, dictEmail.regards),
    },
  };
}

/** Casilla remitente: la de Configuración → Correos o, si está vacía, EMAIL_FROM. */
export async function resolveFromAddress(): Promise<string | null> {
  const settings = await prisma.emailSettings.findUnique({
    where: { id: 1 },
    select: { fromAddress: true },
  });
  return pick(settings?.fromAddress, "") || process.env.EMAIL_FROM || null;
}

/** Quiénes reciben el informe mensual según Configuración → Correos. */
export async function getMonthlyReportRecipients(): Promise<{
  roles: UserRole[];
  toOwner: boolean;
  recipients: MonthlyReportRecipient[];
}> {
  const [settings, users] = await Promise.all([
    prisma.emailSettings.findUnique({
      where: { id: 1 },
      select: { monthlyReportRoles: true, monthlyReportToOwner: true },
    }),
    prisma.user.findMany({
      where: { active: true },
      select: { name: true, email: true, role: true, owner: true, active: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const roles = settings?.monthlyReportRoles ?? DEFAULT_MONTHLY_REPORT_ROLES;
  const toOwner = settings?.monthlyReportToOwner ?? DEFAULT_MONTHLY_REPORT_TO_OWNER;
  return { roles, toOwner, recipients: resolveMonthlyReportRecipients(users, { roles, toOwner }) };
}
