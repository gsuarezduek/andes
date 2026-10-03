"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { TextField, TextareaField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ConfirmDeleteCard } from "@/components/ui/confirm-delete-card";
import { ChevronRightIcon, EyeIcon, EyeOffIcon, CopyIcon } from "@/components/ui/icons";
import { PasswordField } from "@/components/access/password-field";
import { formatDateTime } from "@/lib/datetime";
import { updateAccessCredential, deleteAccessCredential, revealAccessCredentialField } from "@/app/(app)/access/actions";
import type { AccessCredentialRow as AccessCredentialRowData } from "@/lib/access-credentials";
import type { AccessCredentialField } from "@prisma/client";

const MODAL_TITLES = { view: "Acceso", edit: "Editar acceso", confirmDelete: "Eliminar acceso" } as const;

const FIELD_LABELS: Record<AccessCredentialField, string> = {
  password: "la contraseña",
  extra: "el extra",
};

/**
 * Fila de un acceso — cualquier rol puede cargar/editar/borrar (ver
 * `updateAccessCredential`/`deleteAccessCredential`). En reposo solo muestra
 * servicio+usuario, nunca password/extra (ni enmascarados): esos recién se
 * piden al servidor con "Mostrar", dentro del modal — mismo patrón de
 * detalle-en-modal que `MovementRow` de Caja.
 */
export function AccessCredentialRow({
  credential,
  canReveal,
}: {
  credential: AccessCredentialRowData;
  canReveal: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"view" | "edit" | "confirmDelete">("view");
  const [revealed, setRevealed] = useState<Partial<Record<AccessCredentialField, string>>>({});
  const [revealError, setRevealError] = useState<string | null>(null);
  const [revealing, setRevealing] = useState<AccessCredentialField | null>(null);
  const [, startTransition] = useTransition();

  function openModal() {
    setMode("view");
    setRevealed({});
    setRevealError(null);
    setOpen(true);
  }

  function handleReveal(field: AccessCredentialField) {
    setRevealError(null);
    setRevealing(field);
    startTransition(async () => {
      try {
        const value = await revealAccessCredentialField(credential.id, field);
        setRevealed((r) => ({ ...r, [field]: value }));
      } catch (err) {
        unstable_rethrow(err);
        setRevealError(err instanceof Error ? err.message : "No se pudo revelar este campo.");
      } finally {
        setRevealing(null);
      }
    });
  }

  return (
    <li className="rounded-lg border border-foreground/10 text-sm">
      <button type="button" onClick={openModal} className="flex w-full items-center gap-3 px-3 py-2 text-left">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{credential.service}</p>
          <p className="mt-0.5 truncate text-xs text-foreground/50">
            {credential.username ?? "Sin usuario"}
            {credential.adminOnly ? " · Solo admin" : ""}
          </p>
        </div>
        <ChevronRightIcon className="size-4 shrink-0 text-foreground/30" />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={MODAL_TITLES[mode]}>
        {mode === "view" && (
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-base font-semibold">{credential.service}</p>
              {credential.username && <p className="text-sm text-foreground/70">{credential.username}</p>}
            </div>

            <div className="flex flex-col gap-2 border-t border-foreground/10 pt-3">
              {credential.hasPassword && (
                <RevealableField
                  label="Contraseña"
                  value={revealed.password}
                  canReveal={canReveal}
                  revealing={revealing === "password"}
                  onReveal={() => handleReveal("password")}
                  onHide={() => setRevealed((r) => ({ ...r, password: undefined }))}
                />
              )}
              {credential.hasExtra && (
                <RevealableField
                  label="Extra"
                  value={revealed.extra}
                  canReveal={canReveal}
                  revealing={revealing === "extra"}
                  onReveal={() => handleReveal("extra")}
                  onHide={() => setRevealed((r) => ({ ...r, extra: undefined }))}
                />
              )}
              {!credential.hasPassword && !credential.hasExtra && (
                <p className="text-xs text-foreground/50">Sin contraseña ni extra cargados.</p>
              )}
              {revealError && <p className="text-xs text-red-600">{revealError}</p>}
            </div>

            <dl className="flex flex-col gap-1.5 border-t border-foreground/10 pt-3 text-xs text-foreground/50">
              <div className="flex items-center justify-between gap-3">
                <dt>Cargado por</dt>
                <dd>
                  {credential.createdByName} · {formatDateTime(credential.createdAt)}
                </dd>
              </div>
              {credential.updatedByName && (
                <div className="flex items-center justify-between gap-3">
                  <dt>Editado por</dt>
                  <dd>
                    {credential.updatedByName} · {formatDateTime(credential.updatedAt)}
                  </dd>
                </div>
              )}
              {credential.recentReveals.length > 0 && (
                <div className="flex flex-col gap-1 pt-1">
                  <dt>Visto recientemente</dt>
                  {credential.recentReveals.map((r, i) => (
                    <dd key={i}>
                      {r.userName} vio {FIELD_LABELS[r.field]} · {formatDateTime(r.createdAt)}
                    </dd>
                  ))}
                </div>
              )}
            </dl>

            <div className="mt-1 flex gap-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setMode("edit")}>
                Editar
              </Button>
              <Button type="button" variant="danger" className="flex-1" onClick={() => setMode("confirmDelete")}>
                Eliminar
              </Button>
            </div>
          </div>
        )}

        {mode === "edit" && (
          <form
            action={async (formData: FormData) => {
              await updateAccessCredential(credential.id, formData);
            }}
            className="flex flex-col gap-3"
          >
            <TextField id="service" label="Sitio web o servicio" defaultValue={credential.service} required />
            <TextField id="username" label="Usuario" defaultValue={credential.username ?? ""} />

            <PasswordField
              id="password"
              label="Contraseña"
              hint={credential.hasPassword ? "Dejalo en blanco para conservar la actual." : undefined}
            />
            {credential.hasPassword && (
              <label className="flex items-center gap-2 text-xs text-foreground/60">
                <input type="checkbox" name="removePassword" className="size-4 rounded border-foreground/30" />
                Quitar la contraseña cargada
              </label>
            )}

            <TextareaField
              id="extra"
              label="Extra"
              hint={
                credential.hasExtra
                  ? "Dejalo en blanco para conservar el actual."
                  : "Segundo factor, códigos de recuperación, u otro dato"
              }
              rows={2}
            />
            {credential.hasExtra && (
              <label className="flex items-center gap-2 text-xs text-foreground/60">
                <input type="checkbox" name="removeExtra" className="size-4 rounded border-foreground/30" />
                Quitar el extra cargado
              </label>
            )}

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="adminOnly"
                defaultChecked={credential.adminOnly}
                className="size-4 rounded border-foreground/30"
              />
              Solo un admin puede ver la contraseña y el extra
            </label>

            <div className="mt-1 flex items-center gap-3">
              <button type="button" onClick={() => setMode("view")} className="text-xs text-foreground/50">
                Cancelar
              </button>
              <SubmitButton pendingLabel="Guardando…" className="ml-auto">
                Guardar
              </SubmitButton>
            </div>
          </form>
        )}

        {mode === "confirmDelete" && (
          <ConfirmDeleteCard
            as="div"
            message={<>¿Eliminar el acceso de &quot;{credential.service}&quot;? No se puede deshacer.</>}
            action={deleteAccessCredential.bind(null, credential.id)}
            onCancel={() => setMode("view")}
          />
        )}
      </Modal>
    </li>
  );
}

function RevealableField({
  label,
  value,
  canReveal,
  revealing,
  onReveal,
  onHide,
}: {
  label: string;
  value: string | undefined;
  canReveal: boolean;
  revealing: boolean;
  onReveal: () => void;
  onHide: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Sin permiso de portapapeles — no es crítico, el valor ya está visible.
    }
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-foreground/50">{label}</span>
      {value != null ? (
        <div className="flex items-center gap-2">
          <span className="max-w-[12rem] truncate font-mono text-sm">{value}</span>
          <button type="button" onClick={handleCopy} aria-label="Copiar" className="text-foreground/40 hover:text-foreground/70">
            <CopyIcon className="size-4" />
          </button>
          <button type="button" onClick={onHide} aria-label="Ocultar" className="text-foreground/40 hover:text-foreground/70">
            <EyeOffIcon className="size-4" />
          </button>
          {copied && <span className="text-xs text-emerald-600">Copiado</span>}
        </div>
      ) : canReveal ? (
        <button
          type="button"
          onClick={onReveal}
          disabled={revealing}
          className="flex items-center gap-1 text-xs font-medium text-foreground/70 hover:text-foreground disabled:opacity-50"
        >
          <EyeIcon className="size-4" />
          {revealing ? "Mostrando…" : "Mostrar"}
        </button>
      ) : (
        <span className="text-xs text-foreground/40">•••••••• (solo admin)</span>
      )}
    </div>
  );
}
