"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import type { PaymentMethodOwnership } from "@prisma/client";
import { TextField, TextareaField, SelectField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ConfirmDeleteCard } from "@/components/ui/confirm-delete-card";
import { ChevronRightIcon } from "@/components/ui/icons";
import { CurrencyToggle } from "@/components/cash/currency-toggle";
import { PaymentMethodPicker } from "@/components/cash/payment-method-picker";
import { formatMoney } from "@/lib/contract";
import { formatDateTime } from "@/lib/datetime";
import { updateCashMovement, deleteCashMovement } from "@/app/(app)/caja/actions";
import type { CashMovementRow as CashMovementRowData } from "@/lib/cash";
import type { Currency } from "@/lib/currency";

type PaymentMethodOption = { id: string; name: string; requiresNote?: boolean; ownership: PaymentMethodOwnership };
type ExpenseCategoryOption = { id: string; name: string };

const MODAL_TITLES = { view: "Movimiento", edit: "Editar movimiento", confirmDelete: "Eliminar movimiento" } as const;

/**
 * Fila de un movimiento (solo vista admin). En reposo muestra lo esencial —
 * detalle, monto, cuenta y fecha — para poder escanear la lista rápido; el
 * resto (destino, categoría, cliente, quién lo cargó/editó) y las acciones
 * de Editar/Eliminar viven en un modal que se abre al tocar la fila. Antes
 * todo eso iba suelto en la fila (con el "Cliente" muchas veces repitiendo
 * lo que ya decía el Detalle) y el editar era un ícono aparte — pedido del
 * dueño para bajar el ruido visual.
 */
export function MovementRow({
  movement,
  tone,
  paymentMethods,
  expenseCategories,
  canEdit = true,
}: {
  movement: CashMovementRowData;
  tone: "emerald" | "red";
  paymentMethods: PaymentMethodOption[];
  expenseCategories: ExpenseCategoryOption[];
  /** Falso para roles sin permiso de edición: el modal solo muestra el detalle. */
  canEdit?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"view" | "edit" | "confirmDelete">("view");
  const [currency, setCurrency] = useState<Currency>(movement.currency);
  const [paymentMethodId, setPaymentMethodId] = useState(movement.paymentMethodId ?? "");
  const [recipientPaymentMethodId, setRecipientPaymentMethodId] = useState(
    movement.recipientPaymentMethodId ?? "",
  );
  const selectedMethod = paymentMethods.find((m) => m.id === paymentMethodId);
  const selectedRecipient = paymentMethods.find((m) => m.id === recipientPaymentMethodId);
  const isExpense = movement.type === "expense";
  const thirdPartyMethods = paymentMethods.filter((m) => m.ownership !== "own");
  const amountToneClass = tone === "emerald" ? "text-emerald-600" : "text-red-600";

  function openModal() {
    setMode("view");
    setCurrency(movement.currency);
    setPaymentMethodId(movement.paymentMethodId ?? "");
    setRecipientPaymentMethodId(movement.recipientPaymentMethodId ?? "");
    setOpen(true);
  }

  return (
    <li className="rounded-lg border border-foreground/10 text-sm">
      <button type="button" onClick={openModal} className="flex w-full items-center gap-3 px-3 py-2 text-left">
        <div className="min-w-0 flex-1">
          <p className="truncate">{movement.description}</p>
          <p className="mt-0.5 truncate text-xs text-foreground/50">
            {movement.paymentMethodName} · {formatDateTime(movement.createdAt)}
          </p>
        </div>
        <span className={`shrink-0 font-semibold ${amountToneClass}`}>
          {formatMoney(movement.amount, movement.currency)}
        </span>
        <ChevronRightIcon className="size-4 shrink-0 text-foreground/30" />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={MODAL_TITLES[mode]}>
        {mode === "view" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 whitespace-pre-wrap text-sm">{movement.description}</p>
              <span className={`shrink-0 text-base font-semibold ${amountToneClass}`}>
                {formatMoney(movement.amount, movement.currency)}
              </span>
            </div>
            <dl className="flex flex-col gap-1.5 border-t border-foreground/10 pt-3 text-sm">
              <DetailRow
                label={isExpense ? "Origen" : "Cuenta destino"}
                value={
                  movement.paymentMethodName +
                  (movement.paymentMethodNote ? ` (${movement.paymentMethodNote})` : "")
                }
              />
              {movement.recipientPaymentMethodName && (
                <DetailRow
                  label="Destino"
                  value={
                    movement.recipientPaymentMethodName +
                    (movement.recipientPaymentMethodNote ? ` (${movement.recipientPaymentMethodNote})` : "")
                  }
                />
              )}
              {movement.categoryName && <DetailRow label="Categoría" value={movement.categoryName} />}
              {movement.isCommission && (
                <DetailRow label="Generado por" value="Comisión automática de un ingreso" />
              )}
              {movement.rentalClientName && (
                <DetailRow
                  label="Cliente"
                  value={
                    movement.rentalId ? (
                      <Link href={`/rentals/${movement.rentalId}`} className="underline hover:text-foreground/70">
                        {movement.rentalClientName}
                      </Link>
                    ) : (
                      movement.rentalClientName
                    )
                  }
                />
              )}
              <DetailRow label="Cargado por" value={`${movement.createdByName} · ${formatDateTime(movement.createdAt)}`} />
              {movement.lastEditedAt && (
                <DetailRow
                  label="Editado por"
                  value={`${movement.lastEditedByName ?? "—"} · ${formatDateTime(movement.lastEditedAt)}`}
                />
              )}
            </dl>
            {canEdit && (
              <div className="mt-1 flex gap-2">
                <Button type="button" variant="secondary" className="flex-1" onClick={() => setMode("edit")}>
                  Editar
                </Button>
                <Button type="button" variant="danger" className="flex-1" onClick={() => setMode("confirmDelete")}>
                  Eliminar
                </Button>
              </div>
            )}
          </div>
        )}

        {mode === "edit" && (
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
                {expenseCategories.length > 0 && (
                  <SelectField
                    id="categoryId"
                    label="Categoría"
                    hint="Opcional"
                    defaultValue={movement.categoryId ?? ""}
                  >
                    <option value="">Sin categoría</option>
                    {expenseCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </SelectField>
                )}
              </>
            )}
            <div className="mt-1 flex items-center gap-3">
              <button type="button" onClick={() => setMode("view")} className="text-xs text-foreground/50">
                Cancelar
              </button>
              <SubmitButton pendingLabel="Guardando…" className="ml-auto" disabled={!paymentMethodId}>
                Guardar
              </SubmitButton>
            </div>
          </form>
        )}

        {mode === "confirmDelete" && (
          <ConfirmDeleteCard
            as="div"
            message={
              <>
                ¿Eliminar &quot;{movement.description}&quot; ({formatMoney(movement.amount, movement.currency)})? No
                va a aparecer más en los totales.
              </>
            }
            action={deleteCashMovement.bind(null, movement.id)}
            onCancel={() => setMode("view")}
            requireNote
          />
        )}
      </Modal>
    </li>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-foreground/50">{label}</dt>
      <dd className="min-w-0 text-right">{value}</dd>
    </div>
  );
}
