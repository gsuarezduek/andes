import { TextField } from "@/components/ui/fields";
import { SignatureCanvas } from "@/components/inspection/signature-canvas";
import { dropUpload } from "@/lib/client/upload-queue";
import { formatArs } from "@/lib/contract";
import { Row } from "@/components/ui/row";
import { RemoteSignaturePanel } from "../remote-signature-panel";
import type { StepContext } from "../context";

export function StepFirma({ ctx }: { ctx: StepContext }) {
  const {
    draft,
    patch,
    dict,
    isHandover,
    settlement,
    signConditionRows,
    generalParagraphs,
    clientAccepted,
    setClientAccepted,
    sigRef,
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
              <Row key={i} label={r.label} value={r.value} />
            ))}
            {!isHandover && settlement && settlement.balanceDue > 0 && (
              <Row label={dict.acta.settlement.balanceDue} value={formatArs(settlement.balanceDue)} tone="warn" />
            )}
            {!isHandover && settlement && settlement.depositReturn > 0 && (
              <Row label={dict.acta.settlement.depositReturn} value={formatArs(settlement.depositReturn)} />
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
          <p className="text-xs text-emerald-600">Firma registrada. Volvé a firmar para reemplazarla.</p>
        ) : draft.signaturePendingId ? (
          <p className="text-xs text-amber-600">Firma tomada; se subirá al volver la señal.</p>
        ) : draft.signatureUploadFailed ? (
          <p className="text-xs text-amber-600">
            La firma tuvo un error al subir, pero se puede confirmar igual: se va a reintentar sola. Si preferís, volvé a firmar.
          </p>
        ) : null}
        <TextField id="signerName" label={dict.signature.signerName} value={draft.signerName} onChange={(e) => patch({ signerName: e.target.value })} />
      </div>

      <div className="border-t border-foreground/10 pt-3">
        <RemoteSignaturePanel ctx={ctx} variant="firma" />
      </div>
    </div>
  );
}
