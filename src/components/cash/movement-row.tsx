"use client";

import { useState } from "react";
import type { PaymentMethodOwnership } from "@prisma/client";
import { TextField, TextareaField, SelectField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatArs } from "@/lib/contract";
import { formatDateTime } from "@/lib/datetime";
import { updateCashMovement, deleteCashMovement } from "@/app/(app)/caja/actions";
import type { CashMovementRow as CashMovementRowData } from "@/lib/cash";

type PaymentMethodOption = { id: string; name: string; requiresNote?: boolean; ownership: PaymentMethodOwnership };

/**
 * Fila de un movimiento (solo se usa en la vista admin). En reposo solo
 * muestra el ícono de editar; "Eliminar" vive adentro del formulario de
 * edición (a propósito, para que no esté tan a mano). El caller debe pasar
 * una `key` que cambie cuando cambien los datos del movimiento (ver
 * `cash-month-detail.tsx`) para que, tras guardar una edición, el componente
 * se remonte con los valores nuevos en vez de quedar pegado al `defaultValue`
 * con el que se abrió.
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
  const [recipientPaymentMethodId, setRecipientPaymentMethodId] = useState(
    movement.recipientPaymentMethodId ?? "",
  );
  const selectedMethod = paymentMethods.find((m) => m.id === paymentMethodId);
  const selectedRecipient = paymentMethods.find((m) => m.id === recipientPaymentMethodId);
  const isExpense = movement.type === "expense";
  const ownMethods = paymentMethods.filter((m) => m.ownership === "own");
  const thirdPartyMethods = paymentMethods.filter((m) => m.ownership === "third_party");
  const methodOptions = isExpense ? ownMethods : paymentMethods;

  if (mode === "confirmDelete") {
    return (
      <li className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-3 text-sm">
        <p className="text-red-600">
          ¿Eliminar &quot;{movement.description}&quot; ({formatArs(movement.amount)})? No va a aparecer más en los
          totales.
        </p>
        <form action={deleteCashMovement.bind(null, movement.id)} className="mt-2 flex items-center gap-3">
          <button type="button" onClick={() => setMode("edit")} className="text-xs text-foreground/50">
            Volver
          </button>
          <SubmitButton pendingLabel="Eliminando…" variant="danger" className="ml-auto h-auto px-2.5 py-1 text-xs">
            Sí, eliminar
          </SubmitButton>
        </form>
      </li>
    );
  }

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
            label={isExpense ? "Origen" : "Medio de pago"}
            required
            value={paymentMethodId}
            onChange={(e) => setPaymentMethodId(e.target.value)}
          >
            <option value="" disabled>
              {isExpense ? "Elegí de dónde sale la plata" : "Elegí un medio de pago"}
            </option>
            {methodOptions.map((m) => (
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
          {isExpense && (
            <>
              <SelectField
                id="recipientPaymentMethodId"
                label="Destino"
                hint="Opcional — cuenta ajena a la que se le pagó"
                value={recipientPaymentMethodId}
                onChange={(e) => setRecipientPaymentMethodId(e.target.value)}
              >
                <option value="">Sin destino específico</option>
                {thirdPartyMethods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </SelectField>
              {selectedRecipient?.requiresNote && (
                <TextField
                  id="recipientPaymentMethodNote"
                  label="¿A dónde fue? (destino)"
                  hint="Obligatorio para este destino"
                  defaultValue={movement.recipientPaymentMethodNote ?? ""}
                  required
                />
              )}
            </>
          )}
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
        <p className={`shrink-0 font-semibold ${tone === "emerald" ? "text-emerald-600" : "text-red-600"}`}>
          {formatArs(movement.amount)}
        </p>
      </div>
      <p className="mt-1 text-xs text-foreground/50">
        {movement.paymentMethodName}
        {movement.paymentMethodNote ? ` (${movement.paymentMethodNote})` : ""}
        {movement.recipientPaymentMethodName ? ` → ${movement.recipientPaymentMethodName}` : ""}
        {movement.recipientPaymentMethodNote ? ` (${movement.recipientPaymentMethodNote})` : ""}
        {movement.rentalClientName ? ` · ${movement.rentalClientName}` : ""} · {movement.createdByName} ·{" "}
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
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4">
            <path d="M13.586 2.586a2 2 0 1 1 2.828 2.828l-.793.793-2.828-2.828.793-.793ZM11.379 4.793 3 13.172V17h3.828l8.379-8.379-3.828-3.828Z" />
          </svg>
        </button>
      </div>
    </li>
  );
}
