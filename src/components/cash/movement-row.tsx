"use client";

import { useState } from "react";
import { TextField, TextareaField, SelectField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatArs } from "@/lib/contract";
import { formatDateTime } from "@/lib/datetime";
import { updateCashMovement, deleteCashMovement } from "@/app/(app)/caja/actions";
import type { CashMovementRow as CashMovementRowData } from "@/lib/cash";

type PaymentMethodOption = { id: string; name: string; requiresNote?: boolean };

/**
 * Fila de un movimiento con "Editar"/"Eliminar" (solo se usa en la vista
 * admin). El caller debe pasar una `key` que cambie cuando cambien los datos
 * del movimiento (ver `cash-month-detail.tsx`) para que, tras guardar una
 * edición, el componente se remonte con los valores nuevos en vez de quedar
 * pegado al `defaultValue` con el que se abrió.
 */
export function MovementRow({
  movement,
  tone,
  paymentMethods,
}: {
  movement: CashMovementRowData;
  tone: "emerald" | "red";
  paymentMethods: PaymentMethodOption[];
}) {
  const [mode, setMode] = useState<"view" | "edit" | "confirmDelete">("view");
  const [paymentMethodId, setPaymentMethodId] = useState(movement.paymentMethodId ?? "");
  const selectedMethod = paymentMethods.find((m) => m.id === paymentMethodId);

  if (mode === "edit") {
    return (
      <li className="rounded-lg border border-foreground/15 px-3 py-3 text-sm">
        <form action={updateCashMovement.bind(null, movement.id)} className="flex flex-col gap-2">
          <TextareaField id="description" label="Detalle" defaultValue={movement.description} required rows={2} />
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
          <SelectField
            id="paymentMethodId"
            label="Medio de pago"
            required
            value={paymentMethodId}
            onChange={(e) => setPaymentMethodId(e.target.value)}
          >
            <option value="" disabled>
              Elegí un medio de pago
            </option>
            {paymentMethods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </SelectField>
          {selectedMethod?.requiresNote && (
            <TextField
              id="paymentMethodNote"
              label="¿A dónde fue?"
              hint="Obligatorio para este medio de pago"
              defaultValue={movement.paymentMethodNote ?? ""}
              required
            />
          )}
          <div className="mt-1 flex items-center gap-3">
            <button type="button" onClick={() => setMode("view")} className="text-xs text-foreground/50">
              Cancelar
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
        <p className={`shrink-0 font-semibold ${tone === "emerald" ? "text-emerald-600" : "text-red-600"}`}>
          {formatArs(movement.amount)}
        </p>
      </div>
      <p className="mt-1 text-xs text-foreground/50">
        {movement.paymentMethodName}
        {movement.paymentMethodNote ? ` (${movement.paymentMethodNote})` : ""}
        {movement.rentalClientName ? ` · ${movement.rentalClientName}` : ""} · {movement.createdByName} ·{" "}
        {formatDateTime(movement.createdAt)}
      </p>
      <div className="mt-1.5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setMode("edit")}
          className="text-xs font-medium text-foreground/60 underline"
        >
          Editar
        </button>
        {mode === "confirmDelete" ? (
          <form action={deleteCashMovement.bind(null, movement.id)} className="flex items-center gap-2">
            <span className="text-xs text-red-600">¿Eliminar?</span>
            <SubmitButton pendingLabel="Eliminando…" variant="danger" className="h-auto px-2 py-0.5 text-xs">
              Sí, eliminar
            </SubmitButton>
            <button type="button" onClick={() => setMode("view")} className="text-xs text-foreground/50">
              No
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setMode("confirmDelete")}
            className="text-xs font-medium text-red-600 underline"
          >
            Eliminar
          </button>
        )}
      </div>
    </li>
  );
}
