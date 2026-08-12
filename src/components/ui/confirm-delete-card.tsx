import type { ReactNode } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { TextareaField } from "@/components/ui/fields";

/**
 * Tarjeta de confirmación de borrado in-place, para usar dentro de un <ul>
 * (reemplaza la fila mientras se confirma). Mismo patrón que ya se repetía
 * en MovementRow/SafeMovementRow — un solo lugar para el estilo y el flujo.
 *
 * `requireNote` agrega un campo "Motivo" obligatorio (id `note` en el
 * FormData) para cuando el caller quiere dejar constancia de por qué se
 * eliminó (ver MovementRow, que lo guarda en el historial de ediciones).
 */
export function ConfirmDeleteCard({
  message,
  action,
  onCancel,
  requireNote = false,
}: {
  message: ReactNode;
  action: (formData: FormData) => void | Promise<void>;
  onCancel: () => void;
  requireNote?: boolean;
}) {
  return (
    <li className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-3 text-sm">
      <p className="text-red-600">{message}</p>
      <form action={action} className="mt-2 flex flex-col gap-2">
        {requireNote && (
          <TextareaField id="note" label="Motivo" hint="Por qué se elimina — queda en el historial" required rows={2} />
        )}
        <div className="flex items-center gap-3">
          <button type="button" onClick={onCancel} className="text-xs text-foreground/50">
            Volver
          </button>
          <SubmitButton pendingLabel="Eliminando…" variant="danger" className="ml-auto h-auto px-2.5 py-1 text-xs">
            Sí, eliminar
          </SubmitButton>
        </div>
      </form>
    </li>
  );
}
