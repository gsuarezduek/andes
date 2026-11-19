"use client";

import { useState } from "react";
import type { UserRole } from "@prisma/client";
import { userRoleLabels } from "@/lib/labels";
import {
  MONTHLY_REPORT_ROLE_OPTIONS,
  resolveMonthlyReportRecipients,
  type RecipientCandidate,
} from "@/lib/email/monthly-report-recipients";

/**
 * Casillas de quién recibe el informe mensual, con la lista de destinatarios
 * reales recalculada en vivo (antes de guardar) — así se ve a quién le va a
 * llegar, no solo qué roles se tildaron.
 */
export function MonthlyReportField({
  users,
  initialRoles,
  initialToOwner,
}: {
  users: RecipientCandidate[];
  initialRoles: UserRole[];
  initialToOwner: boolean;
}) {
  const [roles, setRoles] = useState<UserRole[]>(initialRoles);
  const [toOwner, setToOwner] = useState(initialToOwner);
  const recipients = resolveMonthlyReportRecipients(users, { roles, toOwner });
  const countByRole = (r: UserRole) => users.filter((u) => u.active && u.role === r).length;
  const ownerName = users.find((u) => u.owner)?.name;

  const toggle = (r: UserRole, on: boolean) =>
    setRoles((prev) => (on ? [...prev, r] : prev.filter((x) => x !== r)));

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">¿A quién le llega?</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {MONTHLY_REPORT_ROLE_OPTIONS.map((r) => (
            <CheckCard
              key={r}
              name="monthlyReportRoles"
              value={r}
              checked={roles.includes(r)}
              onChange={(on) => toggle(r, on)}
              title={userRoleLabels[r]}
              caption={`${countByRole(r)} usuario${countByRole(r) === 1 ? "" : "s"} activo${countByRole(r) === 1 ? "" : "s"}`}
            />
          ))}
          <CheckCard
            name="monthlyReportToOwner"
            checked={toOwner}
            onChange={setToOwner}
            title="Propietario"
            caption={ownerName ?? "Sin propietario cargado"}
          />
        </div>
      </fieldset>

      <div className="rounded-lg bg-foreground/[0.04] p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-foreground/50">
          Lo van a recibir ({recipients.length})
        </p>
        {recipients.length === 0 ? (
          <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
            Nadie. Elegí al menos un rol o el propietario: si no, el botón de Reportes no manda nada.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5">
            {recipients.map((r) => (
              <li key={r.email} className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                <span>
                  <span className="font-medium">{r.name}</span>{" "}
                  <span className="text-foreground/50">{r.email}</span>
                </span>
                {!r.fullAccess && (
                  <span className="text-xs text-foreground/50">sin cuentas de Finanzas</span>
                )}
              </li>
            ))}
          </ul>
        )}
        {recipients.some((r) => !r.fullAccess) && (
          <p className="mt-2 text-xs text-foreground/50">
            Quien no ve las cuentas &quot;Solo Finanzas&quot; recibe el informe calculado sin ellas, igual que en
            Reportes.
          </p>
        )}
      </div>
    </div>
  );
}

/** Casilla grande tipo tarjeta (más fácil de tocar en el celular). */
export function CheckCard({
  name,
  value,
  checked,
  onChange,
  defaultChecked,
  title,
  caption,
}: {
  name: string;
  value?: string;
  checked?: boolean;
  onChange?: (on: boolean) => void;
  defaultChecked?: boolean;
  title: string;
  caption?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-foreground/15 p-3 transition-colors has-[:checked]:border-foreground/40 has-[:checked]:bg-foreground/[0.04]">
      <input
        type="checkbox"
        name={name}
        value={value}
        checked={checked}
        defaultChecked={defaultChecked}
        onChange={onChange ? (e) => onChange(e.target.checked) : undefined}
        className="mt-0.5 size-4 shrink-0"
      />
      <span className="flex flex-col">
        <span className="text-sm font-medium">{title}</span>
        {caption && <span className="text-xs text-foreground/50">{caption}</span>}
      </span>
    </label>
  );
}
