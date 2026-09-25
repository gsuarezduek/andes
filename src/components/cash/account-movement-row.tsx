"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { TextField, TextareaField } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ConfirmDeleteCard } from "@/components/ui/confirm-delete-card";
import { ChevronRightIcon } from "@/components/ui/icons";
import { CurrencyToggle } from "@/components/cash/currency-toggle";
import { PaymentMethodPicker } from "@/components/cash/payment-method-picker";
import { formatMoney } from "@/lib/contract";
import { formatDateTime } from "@/lib/datetime";
import { updateAccountMovement, deleteAccountMovement } from "@/app/(app)/caja/debt-actions";
import type { ThirdPartyLedgerRow } from "@/lib/third-party-accounts";
import type { Currency } from "@/lib/currency";

type PaymentMethodOption = { id: string; name: string; requiresNote?: boolean };
type Kind = "payment" | "debt";
type Mode = "view" | "edit" | "confirmDelete";

const MODAL_TITLES: Record<Mode, string> = {
  view: "Movimiento",
  edit: "Editar movimiento",
  confirmDelete: "Eliminar movimiento",
};

const KIND_LABELS: Record<ThirdPartyLedgerRow["kind"], string> = {
  debt: "Deuda",
  company_payment: "Pago de la empresa",
  client_payment: "Pago directo del cliente",
};

/**
 * Toggle Pago/Deuda — mismo mecanismo visual que `CurrencyToggle` pero
 * compacto, para compartir la fila de botones de `Cancelar/Guardar`.
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
 * Fila de un movimiento de cuenta corriente (proveedor o asociado): Deuda,
 * Pago de la empresa (Egreso) o Pago directo del cliente. Mismo formato que
 * `MovementRow` de Movimientos: en reposo solo lo esencial (detalle, cuenta,
 * fecha y monto) y, al tocar la fila, un modal con el detalle completo y las
 * acciones. Editar/Eliminar solo para admin y solo en Deuda/Pago de la
 * empresa (el pago directo del cliente es de solo lectura: no se carga desde
 * esta sección ni tiene sentido convertirlo). Editar permite cambiar el tipo
 * mismo — un `TypeToggle` Pago/Deuda corrige un movimiento mal cargado sin
 * borrarlo (al pasar a Pago pide el Origen; al pasar a Deuda lo saca) — y la
 * cuenta (Destino) solo dentro de la misma entidad (principal ↔ subcuentas);
 * a otra entidad, se borra y se carga de nuevo.
 */
export function AccountMovementRow({
  movement,
  isAdmin,
  principalName,
  paymentMethods,
  accountOptions,
}: {
  movement: ThirdPartyLedgerRow;
  isAdmin: boolean;
  principalName: string;
  paymentMethods: PaymentMethodOption[];
  /** Cuenta principal + subcuentas de esta entidad (opciones del selector "Destino" al editar). */
  accountOptions: { id: string; name: string; requiresNote?: boolean; parentId?: string | null }[];
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("view");
  const [currency, setCurrency] = useState<Currency>(movement.currency);
  const [kind, setKind] = useState<Kind>(movement.kind === "debt" ? "debt" : "payment");
  const [paymentMethodId, setPaymentMethodId] = useState(movement.originId ?? "");
  const [accountId, setAccountId] = useState(movement.accountId ?? "");
  const selectedOrigin = paymentMethods.find((m) => m.id === paymentMethodId);
  const selectedAccount = accountOptions.find((m) => m.id === accountId);
  const isDebt = movement.kind === "debt";
  const canEdit = isAdmin && movement.kind !== "client_payment";
  const amountText = `${isDebt ? "+" : "−"}${formatMoney(movement.amount, movement.currency)}`;
  const amountToneClass = isDebt ? "text-amber-700 dark:text-amber-400" : "text-emerald-600";
  // Si la cuenta usada es una subcuenta, lo aclara — la vista sigue unificada
  // pero no se pierde por dónde salió/entró la plata.
  const accountText =
    (movement.accountName || principalName) + (movement.accountNote ? ` (${movement.accountNote})` : "");

  function openModal() {
    setMode("view");
    setCurrency(movement.currency);
    setKind(movement.kind === "debt" ? "debt" : "payment");
    setPaymentMethodId(movement.originId ?? "");
    setAccountId(movement.accountId ?? "");
    setOpen(true);
  }

  async function save(formData: FormData) {
    await updateAccountMovement(movement.id, formData);
    setOpen(false);
    setMode("view");
  }

  return (
    <li
      className={`rounded-lg border text-sm ${
        isDebt ? "border-amber-500/20 bg-amber-500/5" : "border-foreground/10"
      }`}
    >
      <button type="button" onClick={openModal} className="flex w-full items-center gap-3 px-3 py-2 text-left">
        <div className="min-w-0 flex-1">
          <p className="truncate">{movement.description}</p>
          <p className="mt-0.5 truncate text-xs text-foreground/50">
            {movement.accountName || principalName} · {formatDateTime(movement.createdAt)}
          </p>
        </div>
        <span className={`shrink-0 font-semibold ${amountToneClass}`}>{amountText}</span>
        <ChevronRightIcon className="size-4 shrink-0 text-foreground/30" />
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={MODAL_TITLES[mode]}>
        {mode === "view" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 whitespace-pre-wrap text-sm">{movement.description}</p>
              <span className={`shrink-0 text-base font-semibold ${amountToneClass}`}>{amountText}</span>
            </div>
            <dl className="flex flex-col gap-1.5 border-t border-foreground/10 pt-3 text-sm">
              <DetailRow label="Tipo" value={KIND_LABELS[movement.kind]} />
              <DetailRow label={movement.kind === "company_payment" ? "Destino" : "Cuenta"} value={accountText} />
              {movement.kind === "company_payment" && movement.originName && (
                <DetailRow
                  label="Origen"
                  value={movement.originName + (movement.originNote ? ` (${movement.originNote})` : "")}
                />
              )}
              {movement.rentalId && (
                <DetailRow
                  label="Reserva"
                  value={
                    <Link href={`/rentals/${movement.rentalId}`} className="underline hover:text-foreground/70">
                      {movement.rentalClientName ?? "Ver reserva"}
                    </Link>
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
          <form action={save} className="flex flex-col gap-2">
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
                  hint="Obligatorio para poder guardar."
                />
                {selectedOrigin?.requiresNote && (
                  <TextField
                    id="paymentMethodNote"
                    label="¿A dónde fue? (origen)"
                    hint="Obligatorio para este medio de pago"
                    defaultValue={movement.originNote ?? ""}
                    required
                  />
                )}
              </>
            )}
            {accountOptions.length > 1 && (
              <PaymentMethodPicker
                id="recipientPaymentMethodId"
                label={kind === "debt" ? "Cuenta" : "Destino"}
                hint={
                  kind === "debt"
                    ? `A cuál cuenta de ${principalName} corresponde esta deuda.`
                    : `A cuál cuenta de ${principalName} le pagamos.`
                }
                options={accountOptions}
                value={accountId}
                onChange={setAccountId}
              />
            )}
            {selectedAccount?.requiresNote && (
              <TextField
                id="recipientPaymentMethodNote"
                label={kind === "debt" ? "¿A dónde fue?" : "¿A dónde fue? (destino)"}
                hint="Obligatorio para esta cuenta"
                defaultValue={accountId === movement.accountId ? (movement.accountNote ?? "") : ""}
                required
              />
            )}
            <div className="mt-1 flex items-center gap-3">
              <button type="button" onClick={() => setMode("view")} className="text-xs text-foreground/50">
                Cancelar
              </button>
              <div className="ml-auto flex items-center gap-2">
                <TypeToggle value={kind} onChange={setKind} />
                <SubmitButton pendingLabel="Guardando…" disabled={kind === "payment" && !paymentMethodId}>
                  Guardar
                </SubmitButton>
              </div>
            </div>
          </form>
        )}

        {mode === "confirmDelete" && (
          <ConfirmDeleteCard
            as="div"
            message={
              <>
                ¿Eliminar &quot;{movement.description}&quot; ({formatMoney(movement.amount, movement.currency)})?{" "}
                {isDebt ? "Deja de sumar a la deuda con esta cuenta." : "Deja de contar como pago a esta cuenta."}
              </>
            }
            action={deleteAccountMovement.bind(null, movement.id)}
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
