"use client";

import { useState } from "react";
import type { PaymentMethodOwnership } from "@prisma/client";
import { TextField, TextareaField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmDeleteCard } from "@/components/ui/confirm-delete-card";
import { EditIcon } from "@/components/ui/icons";
import { CurrencyToggle } from "@/components/cash/currency-toggle";
import { PaymentMethodPicker } from "@/components/cash/payment-method-picker";
import { formatMoney } from "@/lib/contract";
import { formatDateTime } from "@/lib/datetime";
import { updateCashMovement, deleteCashMovement } from "@/app/(app)/caja/actions";
import type { CashMovementRow as CashMovementRowData } from "@/lib/cash";
import type { Currency } from "@/lib/currency";

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
  const [currency, setCurrency] = useState<Currency>(movement.currency);
  const [paymentMethodId, setPaymentMethodId] = useState(movement.paymentMethodId ?? "");
  const [recipientPaymentMethodId, setRecipientPaymentMethodId] = useState(
    movement.recipientPaymentMethodId ?? "",
  );
  const selectedMethod = paymentMethods.find((m) => m.id === paymentMethodId);
  const selectedRecipient = paymentMethods.find((m) => m.id === recipientPaymentMethodId);
  const isExpense = movement.type === "expense";
  const thirdPartyMethods = paymentMethods.filter((m) => m.ownership === "third_party");

  if (mode === "confirmDelete") {
    return (
      <ConfirmDeleteCard
        message={
          <>
            ¿Eliminar &quot;{movement.description}&quot; ({formatMoney(movement.amount, movement.currency)})? No va a
            aparecer más en los totales.
          </>
        }
        action={deleteCashMovement.bind(null, movement.id)}
        onCancel={() => setMode("edit")}
        requireNote
      />
    );
  }

  if (mode === "edit") {
    return (
      <li className="rounded-lg border border-foreground/15 px-3 py-3 text-sm">
        <form action={updateCashMovement.bind(null, movement.id)} className="flex flex-col gap-2">
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
          <PaymentMethodPicker
            id="paymentMethodId"
            label={isExpense ? "Origen" : "Medio de pago"}
            options={paymentMethods}
            value={paymentMethodId}
            onChange={setPaymentMethodId}
            placeholder={isExpense ? "Elegí de dónde sale la plata" : "Buscar medio de pago…"}
          />
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
              <PaymentMethodPicker
                id="recipientPaymentMethodId"
                label="Destino"
                hint="Opcional — cuenta ajena a la que se le pagó"
                options={thirdPartyMethods}
                value={recipientPaymentMethodId}
                onChange={setRecipientPaymentMethodId}
                placeholder="Sin destino específico — buscar…"
              />
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
            <SubmitButton pendingLabel="Guardando…" className="ml-auto" disabled={!paymentMethodId}>
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
          {formatMoney(movement.amount, movement.currency)}
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
          <EditIcon />
        </button>
      </div>
    </li>
  );
}
