"use client";

import { useState } from "react";
import Link from "next/link";
import { TextField, TextareaField } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { SubmitButton } from "@/components/ui/submit-button";
import { ConfirmDeleteCard } from "@/components/ui/confirm-delete-card";
import { PaymentMethodPicker } from "@/components/cash/payment-method-picker";
import { formatMoney, roundMoney } from "@/lib/contract";
import { formatDateTime } from "@/lib/datetime";
import { parseDecimal } from "@/lib/number-input";
import { returnGuarantee, chargeGuarantee } from "@/app/(app)/caja/guarantee-actions";
import { deleteCashMovement, requestCashMovementDeletion } from "@/app/(app)/caja/actions";
import { useCashViewer } from "@/components/cash/cash-viewer-context";
import { ChangeRequestBox } from "@/components/cash/change-request-box";
import type { CashMovementRow } from "@/lib/cash";

type PaymentMethodOption = { id: string; name: string };
type ModalMode = "none" | "return" | "charge" | "delete";

const MODAL_TITLES: Record<Exclude<ModalMode, "none">, string> = {
  return: "Devolver garantía",
  charge: "Cobrar garantía",
  delete: "Eliminar garantía",
};

const REQUEST_DELETE_TITLE = "Pedir eliminación de la garantía";

/**
 * Una garantía activa: descripción + monto + contexto, y las dos formas de
 * cerrarla — "Devolver" (total o parcial; a veces se devuelve menos, y la
 * diferencia queda anotada como un ingreso) o "Cobrar" (total o parcial; si
 * es parcial, el resto se devuelve en el mismo paso) — nunca queda una
 * garantía "a medias", cualquiera de las dos siempre la resuelve del todo.
 * Al resolverla sale de "Activas" y pasa al historial (ver
 * `getGuarantees`/`GuaranteesSection`).
 */
export function GuaranteeCard({
  guarantee,
  paymentMethods,
}: {
  guarantee: CashMovementRow;
  paymentMethods: PaymentMethodOption[];
}) {
  const { canApprove } = useCashViewer();
  const [modal, setModal] = useState<ModalMode>("none");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const request = guarantee.changeRequest;
  const showRequest = request != null && (request.status === "pending" || request.status === "rejected");
  const [returnAmount, setReturnAmount] = useState(String(guarantee.amount));
  const [chargeAmount, setChargeAmount] = useState(String(guarantee.amount));
  const [returnMethodId, setReturnMethodId] = useState(guarantee.paymentMethodId ?? "");
  const [remainderMethodId, setRemainderMethodId] = useState(guarantee.paymentMethodId ?? "");

  const returnParsed = parseDecimal(returnAmount) ?? 0;
  const kept = roundMoney(Math.max(0, guarantee.amount - returnParsed));
  const returnValid = returnParsed > 0 && returnParsed <= guarantee.amount;

  const chargeParsed = parseDecimal(chargeAmount) ?? 0;
  const remainder = roundMoney(Math.max(0, guarantee.amount - chargeParsed));
  const chargeValid = chargeParsed > 0 && chargeParsed <= guarantee.amount;

  function openModal(m: Exclude<ModalMode, "none">) {
    setReturnAmount(String(guarantee.amount));
    setChargeAmount(String(guarantee.amount));
    setReturnMethodId(guarantee.paymentMethodId ?? "");
    setRemainderMethodId(guarantee.paymentMethodId ?? "");
    setDeleteError(null);
    setModal(m);
  }

  return (
    <li className="rounded-lg border border-foreground/10 p-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 whitespace-pre-wrap">{guarantee.description}</p>
        <span className="shrink-0 font-semibold text-foreground">
          {formatMoney(guarantee.amount, guarantee.currency)}
        </span>
      </div>
      <p className="mt-1 text-xs text-foreground/50">
        {guarantee.paymentMethodName}
        {guarantee.paymentMethodNote ? ` (${guarantee.paymentMethodNote})` : ""}
        {guarantee.rentalClientName && (
          <>
            {" · "}
            {guarantee.rentalId ? (
              <Link href={`/rentals/${guarantee.rentalId}`} className="underline hover:text-foreground/70">
                {guarantee.rentalClientName}
              </Link>
            ) : (
              guarantee.rentalClientName
            )}
          </>
        )}
        {` · Cargado por: ${guarantee.createdByName} · ${formatDateTime(guarantee.createdAt)}`}
      </p>
      <div className="mt-2 flex gap-2">
        <Button type="button" variant="secondary" className="flex-1" onClick={() => openModal("return")}>
          Devolver
        </Button>
        <Button type="button" variant="secondary" className="flex-1" onClick={() => openModal("charge")}>
          Cobrar
        </Button>
      </div>
      {showRequest && (
        <div className="mt-2">
          <ChangeRequestBox key={`${request.id}:${request.status}`} request={request} />
        </div>
      )}
      <button
        type="button"
        onClick={() => openModal("delete")}
        className="mt-2 text-xs text-foreground/40 underline hover:text-foreground/60"
      >
        {canApprove ? "Se cargó por error — eliminar" : "Se cargó por error — pedir eliminación"}
      </button>

      <Modal
        open={modal !== "none"}
        onClose={() => setModal("none")}
        title={modal === "none" ? "" : modal === "delete" && !canApprove ? REQUEST_DELETE_TITLE : MODAL_TITLES[modal]}
      >
        {modal === "return" && (
          <form action={returnGuarantee.bind(null, guarantee.id)} className="flex flex-col gap-3">
            <TextField
              id="amount"
              label="Importe a devolver"
              type="text"
              inputMode="decimal"
              prefix="$"
              value={returnAmount}
              onChange={(e) => setReturnAmount(e.target.value)}
              hint={`Hasta ${formatMoney(guarantee.amount, guarantee.currency)} (el total tomado)`}
            />
            {returnParsed > 0 && kept > 0 && (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                La diferencia, {formatMoney(kept, guarantee.currency)}, queda anotada como un ingreso.
              </p>
            )}
            <PaymentMethodPicker
              id="paymentMethodId"
              label="Cuenta de la que sale"
              options={paymentMethods}
              value={returnMethodId}
              onChange={setReturnMethodId}
              placeholder="Buscar cuenta…"
            />
            <TextareaField id="note" label="Nota" hint="Opcional" rows={2} />
            <div className="mt-1 flex gap-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setModal("none")}>
                Cancelar
              </Button>
              <SubmitButton pendingLabel="Guardando…" className="flex-1" disabled={!returnValid || !returnMethodId}>
                Confirmar devolución
              </SubmitButton>
            </div>
          </form>
        )}

        {modal === "charge" && (
          <form action={chargeGuarantee.bind(null, guarantee.id)} className="flex flex-col gap-3">
            <TextField
              id="amount"
              label="Importe a cobrar"
              type="text"
              inputMode="decimal"
              prefix="$"
              value={chargeAmount}
              onChange={(e) => setChargeAmount(e.target.value)}
              hint={`Hasta ${formatMoney(guarantee.amount, guarantee.currency)} (el total tomado)`}
            />
            {chargeParsed > 0 && remainder > 0 && (
              <>
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                  Se devuelven {formatMoney(remainder, guarantee.currency)} del resto, en el mismo paso.
                </p>
                <PaymentMethodPicker
                  id="returnPaymentMethodId"
                  label="Cuenta de la que sale esa devolución"
                  options={paymentMethods}
                  value={remainderMethodId}
                  onChange={setRemainderMethodId}
                  placeholder="Buscar cuenta…"
                />
              </>
            )}
            <div className="mt-1 flex gap-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setModal("none")}>
                Cancelar
              </Button>
              <SubmitButton
                pendingLabel="Guardando…"
                className="flex-1"
                disabled={!chargeValid || (remainder > 0 && !remainderMethodId)}
              >
                Confirmar cobro
              </SubmitButton>
            </div>
          </form>
        )}

        {modal === "delete" && (
          <ConfirmDeleteCard
            as="div"
            message={
              <>
                {canApprove ? "¿Eliminar" : "¿Pedir que se elimine"} la garantía &quot;{guarantee.description}&quot; (
                {formatMoney(guarantee.amount, guarantee.currency)})?
                {!canApprove && " Se elimina recién cuando lo apruebe un administrador o Finanzas."}
              </>
            }
            action={async (fd) => {
              const r = canApprove
                ? await deleteCashMovement(guarantee.id, fd)
                : await requestCashMovementDeletion(guarantee.id, fd);
              if (r.error) setDeleteError(r.error);
              else setModal("none");
            }}
            onCancel={() => setModal("none")}
            requireNote
            error={deleteError}
            {...(canApprove
              ? {}
              : {
                  confirmLabel: "Pedir eliminación",
                  pendingLabel: "Enviando…",
                  noteHint: "Por qué hay que eliminarla — lo ve quien aprueba",
                })}
          />
        )}
      </Modal>
    </li>
  );
}
