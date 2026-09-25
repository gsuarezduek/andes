"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { TextareaField } from "@/components/ui/fields";
import { formatArs, type RentalWriteOff } from "@/lib/contract";
import { formatDateTime } from "@/lib/datetime";
import { writeOffRentalBalance, undoWriteOffRentalBalance } from "@/app/(app)/rentals/[id]/balance-actions";

/**
 * "Aceptar la pérdida" de un saldo pendiente de una reserva ya finalizada
 * (ver `RentalWriteOff`). Todos ven el saldo condonado con quién/cuándo/por
 * qué; solo el admin puede condonar o deshacerlo.
 */
export function BalanceWriteOff({
  rentalId,
  balance,
  writeOff,
  canWriteOff,
  isAdmin,
}: {
  rentalId: string;
  /** Saldo pendiente actual (ya descontado lo condonado). */
  balance: number | null;
  writeOff: RentalWriteOff | null;
  /** La reserva está finalizada (única situación donde se puede condonar). */
  canWriteOff: boolean;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmingUndo, setConfirmingUndo] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const showButton = isAdmin && canWriteOff && balance != null && balance > 0;
  if (!writeOff && !showButton) return null;

  function submit() {
    setError(undefined);
    start(async () => {
      const res = await writeOffRentalBalance(rentalId, reason);
      if (res.error) setError(res.error);
      else {
        setOpen(false);
        setReason("");
      }
    });
  }

  function undo() {
    setError(undefined);
    start(async () => {
      const res = await undoWriteOffRentalBalance(rentalId);
      if (res.error) setError(res.error);
      setConfirmingUndo(false);
    });
  }

  return (
    <>
      {writeOff && (
        <div className="flex flex-col gap-2 rounded-xl border border-foreground/15 bg-foreground/[0.04] p-4 text-sm">
          <p className="font-semibold">Saldo condonado: {formatArs(writeOff.amount)}</p>
          <p className="text-xs text-foreground/60">
            Por {writeOff.byName} · {formatDateTime(new Date(writeOff.at))}
          </p>
          <p className="whitespace-pre-wrap text-xs text-foreground/80">Motivo: {writeOff.reason}</p>
          {isAdmin && !confirmingUndo && (
            <button type="button" onClick={() => setConfirmingUndo(true)} className="self-start text-xs font-medium text-foreground/60 underline">
              Deshacer
            </button>
          )}
          {isAdmin && confirmingUndo && (
            <div className="flex flex-col gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
              <p>¿Deshacer la condonación? El saldo vuelve a figurar como pendiente.</p>
              <div className="flex gap-2">
                <Button type="button" variant="danger" disabled={pending} onClick={undo} className="flex-1">
                  Sí, deshacer
                </Button>
                <Button type="button" variant="secondary" disabled={pending} onClick={() => setConfirmingUndo(false)} className="flex-1">
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {showButton && (
        <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
          Aceptar pérdida (condonar {formatArs(balance)})
        </Button>
      )}

      {error && !open && <p className="text-xs font-medium text-red-600">{error}</p>}

      <Modal open={open} onClose={() => setOpen(false)} title="Condonar saldo">
        <p className="text-sm text-foreground/70">
          Se da por cerrado el saldo de <strong>{formatArs(balance)}</strong>: no se va a cobrar y la reserva deja de
          aparecer como urgente. No mueve la Caja. Queda registrado con tu nombre y el motivo, y se puede deshacer.
        </p>
        <div className="mt-3">
          <TextareaField
            id="write_off_reason"
            label="Motivo"
            hint="Obligatorio. Ej: el cliente se quejó y no se le cobró la diferencia."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={300}
          />
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-4 flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button type="button" className="flex-1" disabled={pending || reason.trim().length < 3} onClick={submit}>
            {pending ? "Guardando…" : "Condonar saldo"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
