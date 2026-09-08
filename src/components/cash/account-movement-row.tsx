"use client";

import { useState } from "react";
import Link from "next/link";
import { TextField, TextareaField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmDeleteCard } from "@/components/ui/confirm-delete-card";
import { CurrencyToggle } from "@/components/cash/currency-toggle";
import { PaymentMethodPicker } from "@/components/cash/payment-method-picker";
import { EditIcon } from "@/components/ui/icons";
import { formatMoney } from "@/lib/contract";
import { formatDateTime } from "@/lib/datetime";
import { updateAccountMovement, deleteAccountMovement } from "@/app/(app)/caja/debt-actions";
import type { ThirdPartyLedgerRow } from "@/lib/third-party-accounts";
import type { Currency } from "@/lib/currency";

type PaymentMethodOption = { id: string; name: string; requiresNote?: boolean };
type Kind = "payment" | "debt";

/**
 * Toggle Pago/Deuda — mismo mecanismo visual que `CurrencyToggle` pero
 * compacto, para compartir la fila de botones de `Cancelar/Eliminar/Guardar`
 * (a la izquierda de "Guardar", como pidió el dueño).
 */
function TypeToggle({ value, onChange }: { value: Kind; onChange: (kind: Kind) => void }) {
  return (
    <div className="flex h-9 rounded-lg border border-foreground/15 p-0.5 text-xs font-semibold">
      <button
        type="button"
        onClick={() => onChange("payment")}
        aria-pressed={value === "payment"}
        className={`rounded-md px-2.5 transition-colors ${
          value === "payment" ? "bg-foreground text-background" : "text-foreground/50"
        }`}
      >
        Pago
      </button>
      <button
        type="button"
        onClick={() => onChange("debt")}
        aria-pressed={value === "debt"}
        className={`rounded-md px-2.5 transition-colors ${
          value === "debt" ? "bg-foreground text-background" : "text-foreground/50"
        }`}
      >
        Deuda
      </button>
    </div>
  );
}

/**
 * Fila de un movimiento de cuenta corriente (proveedor o asociado) que es
 * Deuda o Pago (Egreso) — los dos tipos que se cargan desde acá con los
 * botones "+ Pago"/"+ Deuda" (el "Pago directo del cliente" sigue siendo de
 * solo lectura, ver `LedgerRow`). Editable/borrable solo por admin, mismo
 * patrón que `MovementRow`. El tipo mismo es editable — un `TypeToggle`
 * Pago/Deuda a la izquierda de "Guardar" permite corregir un movimiento mal
 * cargado sin borrarlo: al pasar a Pago pide el Origen (obligatorio); al
 * pasar a Deuda lo saca. La cuenta (Destino) nunca se edita — si está mal,
 * se borra y se carga de nuevo, igual que antes.
 */
export function AccountMovementRow({
  movement,
  isAdmin,
  principalName,
  paymentMethods,
}: {
  movement: ThirdPartyLedgerRow;
  isAdmin: boolean;
  principalName: string;
  paymentMethods: PaymentMethodOption[];
}) {
  const [mode, setMode] = useState<"view" | "edit" | "confirmDelete">("view");
  const [currency, setCurrency] = useState<Currency>(movement.currency);
  const [kind, setKind] = useState<Kind>(movement.kind === "debt" ? "debt" : "payment");
  const [paymentMethodId, setPaymentMethodId] = useState(movement.originId ?? "");
  const selectedOrigin = paymentMethods.find((m) => m.id === paymentMethodId);
  const isDebt = movement.kind === "debt";
  const viaSubaccount = movement.accountName && movement.accountName !== principalName;

  if (mode === "confirmDelete") {
    return (
      <ConfirmDeleteCard
        message={
          <>
            ¿Eliminar &quot;{movement.description}&quot; ({formatMoney(movement.amount, movement.currency)})?{" "}
            {isDebt
              ? "Deja de sumar a la deuda con esta cuenta."
              : "Deja de contar como pago a esta cuenta."}
          </>
        }
        action={deleteAccountMovement.bind(null, movement.id)}
        onCancel={() => setMode("edit")}
        requireNote
      />
    );
  }

  if (mode === "edit") {
    return (
      <li className="rounded-lg border border-foreground/15 px-3 py-3 text-sm">
        <form action={updateAccountMovement.bind(null, movement.id)} className="flex flex-col gap-2">
          <input type="hidden" name="kind" value={kind} />
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
          {kind === "payment" && (
            <>
              <PaymentMethodPicker
                id="paymentMethodId"
                label="Origen"
                options={paymentMethods}
                value={paymentMethodId}
                onChange={setPaymentMethodId}
                placeholder="Elegí de dónde sale la plata"
              />
              {selectedOrigin?.requiresNote && (
                <TextField
                  id="paymentMethodNote"
                  label="¿A dónde fue?"
                  hint="Obligatorio para este medio de pago"
                  defaultValue={movement.originNote ?? ""}
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
            <div className="ml-auto flex items-center gap-2">
              <TypeToggle value={kind} onChange={setKind} />
              <SubmitButton pendingLabel="Guardando…" disabled={kind === "payment" && !paymentMethodId}>
                Guardar
              </SubmitButton>
            </div>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li
      className={`rounded-lg border px-3 py-2 text-sm ${
        isDebt ? "border-amber-500/20 bg-amber-500/5" : "border-foreground/10"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 whitespace-pre-wrap">{movement.description}</p>
        <p
          className={`shrink-0 font-semibold ${
            isDebt ? "text-amber-700 dark:text-amber-400" : "text-emerald-600"
          }`}
        >
          {isDebt ? "+" : "−"}
          {formatMoney(movement.amount, movement.currency)}
        </p>
      </div>
      <p className="mt-1 text-xs text-foreground/50">
        {isDebt ? "Deuda" : "Pagado por la empresa"} · Cargado por: {movement.createdByName} ·{" "}
        {formatDateTime(movement.createdAt)}
        {viaSubaccount && ` · vía ${movement.accountName}`}
        {movement.rentalId && (
          <>
            {" · "}
            <Link href={`/rentals/${movement.rentalId}`} className="underline hover:text-foreground/70">
              Ver reserva{movement.rentalClientName ? ` (${movement.rentalClientName})` : ""}
            </Link>
          </>
        )}
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
