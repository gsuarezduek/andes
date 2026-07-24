import { TextField } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";
import { SignatureCanvas } from "@/components/inspection/signature-canvas";
import { dropUpload } from "@/lib/client/upload-queue";
import { formatArs } from "@/lib/contract";
import { CompareRow } from "../compare-row";
import type { StepContext } from "../context";

export function StepFirma({ ctx }: { ctx: StepContext }) {
  const {
    draft,
    patch,
    props,
    dict,
    isHandover,
    settlement,
    signConditionRows,
    generalParagraphs,
    clientAccepted,
    setClientAccepted,
    sigRef,
    remote,
    remoteStatus,
    remoteBusy,
    startRemoteSign,
    cancelRemote,
  } = ctx;
  return (
    <div className="flex flex-col gap-3">
      {/* Condiciones económicas (entrega) o liquidación (devolución). */}
      {signConditionRows && signConditionRows.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-foreground/80">
            {isHandover ? dict.acta.termsTitle : dict.acta.settlement.title}
          </h3>
          <div className="divide-y divide-foreground/10 rounded-xl border border-foreground/10 px-4">
            {signConditionRows.map((r, i) => (
              <CompareRow key={i} label={r.label} value={r.value} />
            ))}
            {!isHandover && settlement && settlement.balanceDue > 0 && (
              <CompareRow label={dict.acta.settlement.balanceDue} value={formatArs(settlement.balanceDue)} tone="warn" />
            )}
            {!isHandover && settlement && settlement.depositReturn > 0 && (
              <CompareRow label={dict.acta.settlement.depositReturn} value={formatArs(settlement.depositReturn)} />
            )}
          </div>
        </section>
      )}

      {/* Condiciones generales (texto legal completo). */}
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground/80">{dict.legal.title}</h3>
        <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-foreground/10 px-4 py-3 text-xs leading-relaxed text-foreground/70">
          {generalParagraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </section>

      {/* Aceptación explícita del cliente: habilita la firma local. */}
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-foreground/15 px-4 py-3 text-sm">
        <input type="checkbox" checked={clientAccepted} onChange={(e) => setClientAccepted(e.target.checked)} className="mt-0.5 size-5 shrink-0" />
        <span className="text-foreground/80">{dict.signature.acceptConditions}</span>
      </label>

      <p className="text-sm text-foreground/70">{dict.signature.legal}</p>

      <div className={`flex flex-col gap-3 ${clientAccepted ? "" : "pointer-events-none opacity-50"}`} aria-disabled={!clientAccepted}>
        <SignatureCanvas ref={sigRef} />
        <div className="flex justify-between">
          <button type="button" className="text-sm text-foreground/60 underline" onClick={() => { sigRef.current?.clear(); if (draft.signaturePendingId) dropUpload(draft.signaturePendingId); patch({ signatureKey: undefined, signaturePendingId: undefined }); }}>
            {dict.signature.clear}
          </button>
        </div>
        {draft.signatureKey ? (
          <p className="text-xs text-green-600">Firma registrada. Volvé a firmar para reemplazarla.</p>
        ) : draft.signaturePendingId ? (
          <p className="text-xs text-amber-600">Firma tomada; se subirá al volver la señal.</p>
        ) : null}
        <TextField id="signerName" label={dict.signature.signerName} value={draft.signerName} onChange={(e) => patch({ signerName: e.target.value })} />
      </div>

      {props.createRemoteSignature && (
        <div className="flex flex-col gap-2 border-t border-foreground/10 pt-3">
          <p className="text-xs font-medium text-foreground/70">¿El cliente prefiere firmar en su teléfono?</p>
          {remoteStatus === "signed" ? (
            <p className="text-sm font-medium text-green-600">Firma del cliente recibida ✓</p>
          ) : !remote ? (
            <Button type="button" variant="secondary" onClick={startRemoteSign} disabled={remoteBusy}>
              {remoteBusy ? "Generando…" : "Generar QR para el cliente"}
            </Button>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-foreground/10 p-3">
              {/* SVG del QR generado en el servidor */}
              <div className="h-44 w-44 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: remote.svg }} />
              <p className="text-center text-xs text-foreground/60">
                {remoteStatus === "error"
                  ? "El pedido venció. Generá uno nuevo."
                  : "El cliente escanea este QR y firma en su teléfono. Esperando la firma…"}
              </p>
              <button type="button" className="text-xs text-foreground/60 underline" onClick={cancelRemote}>
                {remoteStatus === "error" ? "Cerrar" : "Cancelar"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
