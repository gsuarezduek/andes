import type { UserRole } from "@prisma/client";
import { hasFinanceAccess } from "@/lib/user-permissions";

/**
 * Destinatarios del informe mensual (lógica pura, sin base).
 *
 * Se elige por rol (Empleado/Administrador/Finanzas/Socio) más el propietario,
 * que no es un rol sino un flag de `User`. Sin fila en `email_settings` rigen
 * los defaults: Socio + propietario.
 */

export const DEFAULT_MONTHLY_REPORT_ROLES: UserRole[] = ["observador"];
export const DEFAULT_MONTHLY_REPORT_TO_OWNER = true;

/** Orden en que se muestran los roles en Configuración → Correos. */
export const MONTHLY_REPORT_ROLE_OPTIONS: UserRole[] = ["empleado", "admin", "finanzas", "observador"];

export type RecipientCandidate = {
  name: string;
  email: string;
  role: UserRole;
  owner: boolean;
  active: boolean;
};

export type MonthlyReportRecipient = {
  name: string;
  email: string;
  /** Ve las cuentas "solo Finanzas": recibe el informe completo. El resto,
   *  uno sin esas cuentas (mismo criterio que /reports). */
  fullAccess: boolean;
};

export function resolveMonthlyReportRecipients(
  users: RecipientCandidate[],
  config: { roles: UserRole[]; toOwner: boolean },
): MonthlyReportRecipient[] {
  const seen = new Set<string>();
  const out: MonthlyReportRecipient[] = [];
  for (const u of users) {
    if (!u.active) continue;
    if (!config.roles.includes(u.role) && !(config.toOwner && u.owner)) continue;
    const email = u.email.trim();
    const key = email.toLowerCase();
    if (!email || seen.has(key)) continue;
    seen.add(key);
    out.push({ name: u.name, email, fullAccess: hasFinanceAccess(u.role, u.owner) });
  }
  return out;
}

/** Roles válidos del formulario (descarta valores tipeados a mano). */
export function parseMonthlyReportRoles(values: unknown[]): UserRole[] {
  return MONTHLY_REPORT_ROLE_OPTIONS.filter((r) => values.includes(r));
}
