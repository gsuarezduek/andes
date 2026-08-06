import type { ReactNode } from "react";
import { SubmitButton } from "@/components/ui/submit-button";

/**
 * Tarjeta de confirmación de borrado in-place, para usar dentro de un <ul>
 * (reemplaza la fila mientras se confirma). Mismo patrón que ya se repetía
 * en MovementRow/SafeMovementRow — un solo lugar para el estilo y el flujo.
 */
export function ConfirmDeleteCard({
  message,
  action,
  onCancel,
}: {
  message: ReactNode;
  action: (formData: FormData) => void | Promise<void>;
  onCancel: () => void;
}) {
  return (
    <li className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-3 text-sm">
      <p className="text-red-600">{message}</p>
      <form action={action} className="mt-2 flex items-center gap-3">
        <button type="button" onClick={onCancel} className="text-xs text-foreground/50">
          Volver
        </button>
        <SubmitButton pendingLabel="Eliminando…" variant="danger" className="ml-auto h-auto px-2.5 py-1 text-xs">
          Sí, eliminar
        </SubmitButton>
      </form>
    </li>
  );
}
