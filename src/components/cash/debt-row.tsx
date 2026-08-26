"use client";

import { useState } from "react";
import { TextField, TextareaField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmDeleteCard } from "@/components/ui/confirm-delete-card";
import { CurrencyToggle } from "@/components/cash/currency-toggle";
import { EditIcon } from "@/components/ui/icons";
import { formatMoney } from "@/lib/contract";
import { formatDateTime } from "@/lib/datetime";
import { updateDebtMovement, deleteDebtMovement } from "@/app/(app)/caja/debt-actions";
import type { ThirdPartyLedgerRow } from "@/lib/third-party-accounts";
import type { Currency } from "@/lib/currency";

/**
 * Fila de una deuda dentro del historial de una cuenta ajena (proveedor o
 * asociado) — editable/borrable solo por admin (mismo patrón que
 * MovementRow: cualquiera carga, solo admin corrige/borra), pero sin Origen/
 * Destino: la cuenta queda fija al cargarla (ver `updateDebtMovement`). Los
 * pagos que la saldan (Ingreso/Egreso) se editan desde la pestaña
 * Movimientos, no acá.
 */
export function DebtRow({ movement, isAdmin }: { movement: ThirdPartyLedgerRow; isAdmin: boolean }) {
  const [mode, setMode] = useState<"view" | "edit" | "confirmDelete">("view");
  const [currency, setCurrency] = useState<Currency>(movement.currency);

  if (mode === "confirmDelete") {
    return (
      <ConfirmDeleteCard
        message={
          <>
            ¿Eliminar &quot;{movement.description}&quot; ({formatMoney(movement.amount, movement.currency)})? Deja
            de sumar a la deuda con este proveedor.
          </>
        }
        action={deleteDebtMovement.bind(null, movement.id)}
        onCancel={() => setMode("edit")}
        requireNote
      />
    );
  }

  if (mode === "edit") {
    return (
      <li className="rounded-lg border border-foreground/15 px-3 py-3 text-sm">
        <form action={updateDebtMovement.bind(null, movement.id)} className="flex flex-col gap-2">
          <TextareaField id="description" label="Detalle" defaultValue={movement.description} required rows={2} />
          <div className="grid grid-cols-[7fr_3fr] gap-2">
            <TextField
              id="amount"
              label="Monto"
              type="number"
              step="0.01"
              min="0"
              prefix="$"
              defaultValue={movement.amount}
              required
            />
            <CurrencyToggle value={currency} onChange={setCurrency} />
          </div>
          <div className="mt-1 flex items-center gap-3">
            <button type="button" onClick={() => setMode("view")} className="text-xs text-foreground/50">
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => setMode("confirmDelete")}
              className="text-xs font-medium text-red-600 underline"
            >
              Eliminar
            </button>
            <SubmitButton pendingLabel="Guardando…" className="ml-auto">
              Guardar
            </SubmitButton>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 whitespace-pre-wrap">{movement.description}</p>
        <p className="shrink-0 font-semibold text-amber-700 dark:text-amber-400">
          +{formatMoney(movement.amount, movement.currency)}
        </p>
      </div>
      <p className="mt-1 text-xs text-foreground/50">
        Deuda · {movement.createdByName} · {formatDateTime(movement.createdAt)}
      </p>
      {isAdmin && (
        <div className="mt-1.5 flex items-center">
          <button
            type="button"
            onClick={() => setMode("edit")}
            title="Editar"
            aria-label="Editar"
            className="text-foreground/50 hover:text-foreground/80"
          >
            <EditIcon />
          </button>
        </div>
      )}
    </li>
  );
}
