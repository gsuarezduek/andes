"use client";

import { useState, useTransition } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { FormError, TextareaField } from "@/components/ui/fields";
import { Modal } from "@/components/ui/modal";
import { resendOwnerContract, voidOwnerContract } from "@/app/(app)/vehicles/[id]/owner-contract/actions";

/** Ver el PDF, reenviarlo al propietario y (admin) dar de baja el contrato. */
export function OwnerContractActions({
  contractId,
  vehicleId,
  canVoid,
  canResend,
}: {
  contractId: string;
  vehicleId: string;
  canVoid: boolean;
  canResend: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [voiding, setVoiding] = useState(false);
  const [reason, setReason] = useState("");
  const [voidError, setVoidError] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  function resend() {
    setResendMessage(null);
    startTransition(async () => {
      try {
        const result = await resendOwnerContract(contractId, vehicleId);
        setResendMessage(result.ok ? "Enviado." : result.error);
      } catch {
        setResendMessage("No se pudo enviar. Revisá la conexión.");
      }
    });
  }

  function confirmVoid() {
    setVoidError(null);
    startTransition(async () => {
      try {
        const result = await voidOwnerContract(contractId, vehicleId, reason);
        if (result.ok) setVoiding(false);
        else setVoidError(result.error);
      } catch {
        setVoidError("No se pudo dar de baja. Revisá la conexión.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a href={`/api/owner-contracts/${contractId}`} target="_blank" rel="noreferrer" className={buttonClass("secondary")}>
        Ver PDF
      </a>
      {canResend && (
        <Button type="button" variant="secondary" onClick={resend} disabled={pending}>
          Reenviar
        </Button>
      )}
      {canVoid && (
        <Button type="button" variant="secondary" onClick={() => setVoiding(true)} disabled={pending}>
          Dar de baja
        </Button>
      )}
      {resendMessage && <p className="w-full text-xs text-foreground/60">{resendMessage}</p>}

      <Modal open={voiding} onClose={() => setVoiding(false)} title="Dar de baja el contrato">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-foreground/70">
            Deja de contar como vigente, pero sigue en el historial con su PDF. No se puede deshacer.
          </p>
          <TextareaField id={`void-${contractId}`} label="Motivo" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          {voidError && <FormError>{voidError}</FormError>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setVoiding(false)} disabled={pending}>Cancelar</Button>
            <Button type="button" variant="danger" onClick={confirmVoid} disabled={pending || !reason.trim()}>Dar de baja</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
