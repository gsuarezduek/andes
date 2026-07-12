"use client";

import { useRef, useState } from "react";
import { SignatureCanvas, type SignaturePadHandle } from "@/components/inspection/signature-canvas";
import { TextField, FormError } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";
import type { SignatureSummary } from "@/lib/remote-signature";

export function RemoteSignForm({
  id,
  legal,
  signerNameLabel,
  clearLabel,
  confirmLabel,
  summary,
  defaultName,
}: {
  id: string;
  legal: string;
  signerNameLabel: string;
  clearLabel: string;
  confirmLabel: string;
  summary?: SignatureSummary;
  defaultName: string;
}) {
  const sigRef = useRef<SignaturePadHandle>(null);
  const [name, setName] = useState(defaultName);
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string>();

  async function submit() {
    const pad = sigRef.current;
    if (!pad || pad.isEmpty()) return setError("Falta la firma.");
    if (!name.trim()) return setError("Ingresá tu nombre y aclaración.");
    setError(undefined);
    setState("sending");
    try {
      const blob = await (await fetch(pad.toDataURL())).blob();
      const fd = new FormData();
      fd.append("file", blob, "signature.png");
      fd.append("signerName", name.trim());
      const res = await fetch(`/api/sign/${id}`, { method: "POST", body: fd });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "error");
      }
      setState("done");
    } catch {
      setState("idle");
      setError("No se pudo enviar la firma. Reintentá.");
    }
  }

  if (state === "done") {
    return (
      <p className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-6 text-center text-sm font-medium text-green-700 dark:text-green-400">
        ¡Gracias! Tu firma fue enviada. Podés cerrar esta página.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {summary && (
        <div className="divide-y divide-foreground/10 rounded-xl border border-foreground/10 px-4">
          <SummaryRow label="Vehículo" value={summary.vehicleLabel} />
          {summary.datesLabel && <SummaryRow label="Período" value={summary.datesLabel} />}
          <SummaryRow label="Kilometraje" value={`${summary.km.toLocaleString("es-AR")} km`} />
          <SummaryRow label="Nafta" value={`${summary.fuelLevel}/8`} />
          <SummaryRow
            label="Daños"
            value={summary.newDamages.length ? summary.newDamages.join(", ") : "Sin daños nuevos"}
          />
        </div>
      )}

      <p className="text-sm text-foreground/70">{legal}</p>
      <SignatureCanvas ref={sigRef} />
      <button
        type="button"
        className="self-start text-sm text-foreground/60 underline"
        onClick={() => sigRef.current?.clear()}
      >
        {clearLabel}
      </button>
      <TextField id="signerName" label={signerNameLabel} value={name} onChange={(e) => setName(e.target.value)} />
      <FormError>{error}</FormError>
      <Button type="button" onClick={submit} disabled={state === "sending"}>
        {state === "sending" ? "Enviando…" : confirmLabel}
      </Button>
    </div>
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
