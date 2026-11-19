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
import { updateCashMovement, deleteCashMovement, requestCashMovementDeletion } from "@/app/(app)/caja/actions";
import { useCashViewer } from "@/components/cash/cash-viewer-context";
import { ChangeRequestBox } from "@/components/cash/change-request-box";
import { InvoiceRequestControl } from "@/components/cash/invoice-request-control";
import type { CashMovementRow as CashMovementRowData } from "@/lib/cash";
import type { Currency } from "@/lib/currency";

type PaymentMethodOption = { id: string; name: string; requiresNote?: boolean; ownership: PaymentMethodOwnership };
type ExpenseCategoryOption = { id: string; name: string };

const MODAL_TITLES = {
  view: "Movimiento",
  edit: "Editar movimiento",
  confirmDelete: "Eliminar movimiento",
  requestDelete: "Pedir eliminación",
} as const;
type Mode = keyof typeof MODAL_TITLES;

/**
 * Fila de un movimiento. Un admin/finanzas edita y elimina directo; un
 * empleado edita o pide la eliminación, y el cambio queda pendiente hasta que
 * lo aprueben (ver `CashMovementChangeRequest`). En reposo muestra lo esencial — detalle, monto,
 * cuenta y fecha — para poder escanear la lista rápido; el resto (destino,
 * categoría, cliente, quién lo cargó/editó) y las acciones de Editar/Eliminar
 * viven en `MovementDetailModal`, que se abre al tocar la fila. Antes todo
 * eso iba suelto en la fila (con el "Cliente" muchas veces repitiendo lo que
 * ya decía el Detalle) y el editar era un ícono aparte — pedido del dueño
 * para bajar el ruido visual.
 */
export function MovementRow({
  movement,
  tone,
  paymentMethods,
  expenseCategories,
}: {
  movement: CashMovementRowData;
  tone: "emerald" | "red";
  paymentMethods: PaymentMethodOption[];
  expenseCategories: ExpenseCategoryOption[];
}) {
  const [open, setOpen] = useState(false);
  const amountToneClass = tone === "emerald" ? "text-emerald-600" : "text-red-600";

  return (
    <li className="rounded-lg border border-foreground/10 text-sm">
      <button type="button" onClick={() => setOpen(true)} className="flex w-full items-center gap-3 px-3 py-2 text-left">
        <div className="min-w-0 flex-1">
          <p className="truncate">{movement.description}</p>
          {movement.changeRequest?.status === "pending" && (
            <span className="mt-0.5 inline-block rounded bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
              {movement.changeRequest.kind === "delete" ? "Eliminación pendiente" : "Cambio pendiente"}
            </span>
          )}
          <p className="mt-0.5 truncate text-xs text-foreground/50">
            {movement.paymentMethodName} · {formatDateTime(movement.createdAt)}
          </p>
        </div>
        <span className={`shrink-0 font-semibold ${amountToneClass}`}>
          {formatMoney(movement.amount, movement.currency)}
        </span>
        <ChevronRightIcon className="size-4 shrink-0 text-foreground/30" />
      </button>

      <MovementDetailModal
        movement={movement}
        tone={tone}
        paymentMethods={paymentMethods}
        expenseCategories={expenseCategories}
        open={open}
        onClose={() => setOpen(false)}
      />
    </li>
  );
}

/**
 * Modal de detalle de un movimiento (view/edit/confirmDelete) — extraído de
 * `MovementRow` para poder abrirlo también fuera de una lista, ej. al
 * confirmar el alta de un Ingreso/Egreso nuevo (ver `CashMovementForm`).
 */
export function MovementDetailModal({
  movement,
  tone,
  paymentMethods,
  expenseCategories,
  open,
  onClose,
}: {
  movement: CashMovementRowData;
  tone: "emerald" | "red";
  paymentMethods: PaymentMethodOption[];
  expenseCategories: ExpenseCategoryOption[];
  open: boolean;
  onClose: () => void;
}) {
  const { canApprove } = useCashViewer();
  const [mode, setMode] = useState<Mode>("view");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const request = movement.changeRequest;
  const showRequest = request != null && (request.status === "pending" || request.status === "rejected");
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
  // Ya facturado: cuenta, monto y moneda quedan fijos y no se puede borrar
  // (ver `invoicedChangeError`) — solo se puede corregir el detalle.
  const invoiced = movement.invoicedAt != null;

  // Reset al cerrar (no al abrir, para no llamar setState desde un efecto):
  // la próxima vez que se abra, ya arranca en modo vista con los valores
  // actuales — mismo resultado que antes lograba `openModal` en `MovementRow`
  // al click, solo que disparado un paso después.
  function handleClose() {
    setMode("view");
    setError(null);
    setNotice(null);
    setCurrency(movement.currency);
    setPaymentMethodId(movement.paymentMethodId ?? "");
    setRecipientPaymentMethodId(movement.recipientPaymentMethodId ?? "");
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title={MODAL_TITLES[mode]}>
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
              {movement.needsInvoice && (
                <>
                  <DetailRow
                    label="Facturación"
                    value={movement.invoicedAt ? "Facturado" : "Pendiente de facturar"}
                  />
                  {movement.invoiceAuto && <DetailRow label="Motivo" value="La cuenta factura sola" />}
                  {movement.invoicingName && <DetailRow label="Facturar a" value={movement.invoicingName} />}
                  {movement.invoicingCuit && <DetailRow label="CUIT" value={movement.invoicingCuit} />}
                  {movement.invoicedAt && (
                    <DetailRow
                      label="Facturado por"
                      value={`${movement.invoicedByName ?? "—"} · ${formatDateTime(movement.invoicedAt)}`}
                    />
                  )}
                </>
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
              {movement.roomBookingLabel && (
                <DetailRow
                  label="Reserva"
                  value={
                    movement.roomBookingId && movement.roomId ? (
                      <Link
                        href={`/rooms/${movement.roomId}/bookings/${movement.roomBookingId}`}
                        className="underline hover:text-foreground/70"
                      >
                        {movement.roomBookingLabel}
                      </Link>
                    ) : (
                      movement.roomBookingLabel
                    )
                  }
                />
              )}
              <DetailRow label="Cargado por" value={`${movement.createdByName} · ${formatDateTime(movement.createdAt)}`} />
              {movement.lastEditedAt && (
                <DetailRow
                  label="Editado por"
                  value={
                    `${movement.lastEditedByName ?? "—"} · ${formatDateTime(movement.lastEditedAt)}` +
                    (movement.lastEditApprovedByName ? ` · aprobado por ${movement.lastEditApprovedByName}` : "")
                  }
                />
              )}
            </dl>
            {showRequest && <ChangeRequestBox key={`${request.id}:${request.status}`} request={request} />}
            {notice && (
              <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
                {notice}
              </p>
            )}
            {movement.invoiceEligible && (
              <InvoiceRequestControl
                key={`${movement.needsInvoice}:${movement.invoicingName ?? ""}:${movement.invoicingCuit ?? ""}`}
                movementId={movement.id}
                needsInvoice={movement.needsInvoice}
                invoiced={invoiced}
                invoicingName={movement.invoicingName}
                invoicingCuit={movement.invoicingCuit}
                accountAutoInvoice={movement.accountAutoInvoice}
              />
            )}
            <div className="mt-1 flex gap-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setMode("edit")}>
                Editar
              </Button>
              <Button
                type="button"
                variant="danger"
                className="flex-1"
                disabled={invoiced}
                onClick={() => {
                  setError(null);
                  setNotice(null);
                  setMode(canApprove ? "confirmDelete" : "requestDelete");
                }}
              >
                {canApprove ? "Eliminar" : "Pedir eliminación"}
              </Button>
            </div>
            {!canApprove && (
              <p className="text-xs text-foreground/50">
                Los cambios y las eliminaciones los aprueba un administrador o Finanzas.
              </p>
            )}
            {invoiced && (
              <p className="text-xs text-foreground/50">
                Ya está facturado: no se puede eliminar ni cambiar cuenta, monto o moneda. Si se marcó por error,
                volvelo a pendiente en Caja → Facturación.
              </p>
            )}
          </div>
        )}

        {mode === "edit" && (
          <form
            action={async (fd) => {
              setError(null);
              const r = await updateCashMovement(movement.id, fd);
              if (r.error) {
                setError(r.error);
                return;
              }
              if (r.pending) setNotice("Pedido enviado.");
              setMode("view");
            }}
            className="flex flex-col gap-2"
          >
            {!canApprove && (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                El cambio queda pendiente hasta que lo apruebe un administrador o Finanzas.
                {request?.status === "pending" && " Ya hay un pedido pendiente: este lo reemplaza."}
              </p>
            )}
            <TextareaField id="description" label="Detalle" defaultValue={movement.description} required rows={2} />
            {invoiced ? (
              <div className="rounded-lg border border-foreground/10 px-3 py-2 text-sm">
                <input type="hidden" name="amount" value={movement.amount} />
                <input type="hidden" name="currency" value={movement.currency} />
                <input type="hidden" name="paymentMethodId" value={movement.paymentMethodId ?? ""} />
                <p>
                  {formatMoney(movement.amount, movement.currency)} · {movement.paymentMethodName}
                </p>
                <p className="mt-0.5 text-xs text-foreground/50">
                  Ya está facturado: la cuenta, el monto y la moneda no se pueden cambiar.
                </p>
              </div>
            ) : (
              <>
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
              </>
            )}
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
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="mt-1 flex items-center gap-3">
              <button type="button" onClick={() => setMode("view")} className="text-xs text-foreground/50">
                Cancelar
              </button>
              <SubmitButton
                pendingLabel={canApprove ? "Guardando…" : "Enviando…"}
                className="ml-auto"
                disabled={!paymentMethodId}
              >
                {canApprove ? "Guardar" : "Enviar para aprobar"}
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
            action={async (fd) => {
              const r = await deleteCashMovement(movement.id, fd);
              if (r.error) setError(r.error);
            }}
            onCancel={() => setMode("view")}
            requireNote
            error={error}
          />
        )}

        {mode === "requestDelete" && (
          <ConfirmDeleteCard
            as="div"
            message={
              <>
                ¿Pedir que se elimine &quot;{movement.description}&quot; (
                {formatMoney(movement.amount, movement.currency)})? Se elimina recién cuando lo apruebe un
                administrador o Finanzas.
                {request?.status === "pending" && " Ya hay un pedido pendiente: este lo reemplaza."}
              </>
            }
            action={async (fd) => {
              const r = await requestCashMovementDeletion(movement.id, fd);
              if (r.error) {
                setError(r.error);
                return;
              }
              setNotice("Pedido de eliminación enviado.");
              setMode("view");
            }}
            onCancel={() => setMode("view")}
            requireNote
            noteHint="Por qué hay que eliminarlo — lo ve quien aprueba"
            confirmLabel="Pedir eliminación"
            pendingLabel="Enviando…"
            error={error}
          />
        )}
    </Modal>
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
