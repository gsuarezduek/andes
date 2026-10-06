"use client";

import { useRef, useState } from "react";
import { SignatureCanvas, type SignaturePadHandle } from "@/components/inspection/signature-canvas";
import { TextField, FormError } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";
import type { Dictionary } from "@/lib/i18n";
import type { SignatureSummary } from "@/lib/remote-signature";

/**
 * Resumen curado (vehículo, km, nafta, daños, condiciones/liquidación) que ve
 * el cliente por QR — es "lo que cargamos nosotros", secundario frente a las
 * condiciones generales del contrato (que se muestran aparte, a nivel de
 * página, antes que esto). Se usa tanto mientras el empleado todavía está
 * completando el wizard (vista "en vivo") como ya lista para firmar — mismo
 * contenido, misma presentación en los dos casos.
 */
export function SignatureSummaryView({
  summary,
  isReturn,
  dict,
}: {
  summary?: SignatureSummary;
  isReturn: boolean;
  dict: Dictionary;
}) {
  const conditionRows = isReturn ? summary?.settlementRows : summary?.conditions;
  const conditionsTitle = isReturn ? dict.acta.settlement.title : dict.acta.termsTitle;
  if (!summary) return null;
  return (
    <>
      <div className="divide-y divide-foreground/10 rounded-xl border border-foreground/10 px-4">
        <SummaryRow label={dict.acta.vehicle} value={summary.vehicleLabel} />
        {summary.datesLabel && <SummaryRow label={dict.remoteSign.period} value={summary.datesLabel} />}
        <SummaryRow label={dict.acta.mileage} value={`${summary.km.toLocaleString("es-AR")} km`} />
        <SummaryRow label={dict.acta.fuelLevel} value={`${summary.fuelLevel}/${summary.maxFuel ?? 8}`} />
        <SummaryRow
          label={dict.acta.damages}
          value={summary.newDamages.length ? summary.newDamages.join(", ") : dict.remoteSign.noNewDamages}
        />
      </div>

      {/* Condiciones económicas (entrega) o liquidación (devolución). */}
      {conditionRows && conditionRows.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-foreground/80">{conditionsTitle}</h3>
          <div className="divide-y divide-foreground/10 rounded-xl border border-foreground/10 px-4">
            {conditionRows.map((r, i) => (
              <SummaryRow key={i} label={r.label} value={r.value} />
            ))}
            {isReturn && summary?.balanceRows?.map((r, i) => (
              <div key={i} className="flex justify-between gap-4 py-2 text-sm font-semibold">
                <span>{r.label}</span>
                <span className="text-right">{r.value}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

export function RemoteSignForm({
  id,
  dict,
  defaultName,
}: {
  id: string;
  dict: Dictionary;
  defaultName: string;
}) {
  const sigRef = useRef<SignaturePadHandle>(null);
  const [name, setName] = useState(defaultName);
  const [accepted, setAccepted] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string>();

  async function submit() {
    if (!accepted) return setError(dict.remoteSign.acceptRequiredError);
    const pad = sigRef.current;
    if (!pad || pad.isEmpty()) return setError(dict.remoteSign.missingSignatureError);
    if (!name.trim()) return setError(dict.remoteSign.missingNameError);
    setError(undefined);
    setState("sending");
    try {
      const blob = await (await fetch(pad.toDataURL())).blob();
      const fd = new FormData();
      fd.append("file", blob, "signature.png");
      fd.append("signerName", name.trim());
      fd.append("accepted", "true");
      const res = await fetch(`/api/sign/${id}`, { method: "POST", body: fd });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "error");
      }
      setState("done");
    } catch {
      setState("idle");
      setError(dict.remoteSign.sendError);
    }
  }

  if (state === "done") {
    return (
      <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-6 text-center text-sm font-medium text-emerald-700 dark:text-emerald-400">
        {dict.remoteSign.signedDone}
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-foreground/10 p-4">
      <h2 className="text-sm font-semibold text-foreground/70">{dict.signature.title}</h2>

      {/* Aceptación explícita: habilita la firma. Las condiciones generales ya
          se mostraron arriba, al tope de la página — acá solo queda confirmar
          que se leyeron. */}
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-foreground/15 px-4 py-3 text-sm">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5 size-5 shrink-0"
        />
        <span className="text-foreground/80">{dict.signature.acceptConditions}</span>
      </label>

      <p className="text-xs text-foreground/60">{dict.signature.legal}</p>

      {/* La firma se habilita recién cuando el cliente acepta las condiciones. */}
      <div className={`flex flex-col gap-4 ${accepted ? "" : "pointer-events-none opacity-50"}`} aria-disabled={!accepted}>
        <SignatureCanvas ref={sigRef} />
        <button
          type="button"
          className="self-start text-sm text-foreground/60 underline"
          onClick={() => sigRef.current?.clear()}
        >
          {dict.signature.clear}
        </button>
        <TextField
          id="signerName"
          label={dict.signature.signerName}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <FormError>{error}</FormError>
      <Button type="button" onClick={submit} disabled={!accepted || state === "sending"}>
        {state === "sending" ? dict.remoteSign.sending : dict.signature.confirm}
      </Button>
    </section>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <span className="text-foreground/60">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
