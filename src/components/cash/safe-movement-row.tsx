"use client";

import { useState } from "react";
import { TextField, TextareaField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmDeleteCard } from "@/components/ui/confirm-delete-card";
import { EditIcon } from "@/components/ui/icons";
import { CurrencyToggle } from "@/components/cash/currency-toggle";
import { formatMoney } from "@/lib/contract";
import { formatDateTime } from "@/lib/datetime";
import { updateSafeMovement, deleteSafeMovement } from "@/app/(app)/caja/safe-actions";
import type { SafeMovementRow as SafeMovementRowData } from "@/lib/safe";
import type { Currency } from "@/lib/currency";

/** Fila de un movimiento de caja fuerte (solo vista admin) — mismo patrón de
 *  edición/borrado que MovementRow (Ingresos/Egresos), sin medio de pago. */
export function SafeMovementRow({ movement }: { movement: SafeMovementRowData }) {
  const [mode, setMode] = useState<"view" | "edit" | "confirmDelete">("view");
  const [currency, setCurrency] = useState<Currency>(movement.currency);
  const tone = movement.type === "deposit" ? "text-emerald-600" : "text-red-600";

  if (mode === "confirmDelete") {
    return (
      <ConfirmDeleteCard
        message={
          <>
            ¿Eliminar &quot;{movement.description}&quot; ({formatMoney(movement.amount, movement.currency)})? No va
            a aparecer más en el saldo.
          </>
        }
        action={deleteSafeMovement.bind(null, movement.id)}
        onCancel={() => setMode("edit")}
      />
    );
  }

  if (mode === "edit") {
    return (
      <li className="rounded-lg border border-foreground/15 px-3 py-3 text-sm">
        <form action={updateSafeMovement.bind(null, movement.id)} className="flex flex-col gap-2">
          <TextareaField id="description" label="Motivo" defaultValue={movement.description} required rows={2} />
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
    <li className="rounded-lg border border-foreground/10 px-3 py-2 text-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 whitespace-pre-wrap">{movement.description}</p>
        <p className={`shrink-0 font-semibold ${tone}`}>
          {movement.type === "deposit" ? "+" : "-"}
          {formatMoney(movement.amount, movement.currency)}
        </p>
      </div>
      <p className="mt-1 text-xs text-foreground/50">
        {movement.type === "deposit" ? "Ingreso" : "Retiro"} · Cargado por: {movement.createdByName} ·{" "}
        {formatDateTime(movement.createdAt)}
      </p>
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
    </li>
  );
}
