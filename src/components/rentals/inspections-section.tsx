"use client";

import { useState, useTransition } from "react";
import { formatDateTime } from "@/lib/datetime";
import { Badge } from "@/components/ui/badge";
import { resendActaEmail } from "@/app/(app)/rentals/[id]/acta-actions";
import type { RentalDetail } from "@/lib/rental-detail-queries";

type Inspection = RentalDetail["inspections"][number];

/** Badge del estado del envío del acta al CLIENTE (lo que reportó el dueño:
 *  necesita ver si el cliente realmente la recibió, para mandarla por otro
 *  medio si no). El del admin se resume aparte, más chico, solo si falló. */
function ClientEmailBadge({ inspection }: { inspection: Inspection }) {
  const status = inspection.actaClientEmailStatus;
  const error = inspection.actaClientEmailError;
  if (status === "sent") {
    return (
      <Badge tone="emerald">
        Enviada al cliente{inspection.actaClientEmailSentAt ? ` · ${formatDateTime(inspection.actaClientEmailSentAt)}` : ""}
      </Badge>
    );
  }
  if (status === "failed") {
    return <Badge tone="red">No le llegó al cliente{error ? ` — ${error}` : ""}</Badge>;
  }
  if (status === "skipped") {
    return <Badge tone="amber">No se envió al cliente{error ? ` — ${error}` : ""}</Badge>;
  }
  return <Badge tone="neutral">Sin información de envío</Badge>;
}

function ResendButton({ rentalId, inspectionId }: { rentalId: string; inspectionId: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const run = () =>
    start(async () => {
      setResult(null);
      const r = await resendActaEmail(rentalId, inspectionId);
      setResult(r);
    });
  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="shrink-0 text-xs font-medium underline disabled:opacity-60"
      >
        {pending ? "Reenviando…" : "Reenviar acta por email"}
      </button>
      {result && !pending && (
        <p className={`text-xs ${result.ok ? "text-emerald-600" : "text-red-600"}`}>
          {result.ok ? "Reenviado." : (result.error ?? "No se pudo reenviar.")}
        </p>
      )}
    </div>
  );
}

export function InspectionsSection({
  rentalId,
  inspections,
}: {
  rentalId: string;
  inspections: RentalDetail["inspections"];
}) {
  if (inspections.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-foreground/70">Actas</h2>
      <ul className="flex flex-col divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
        {inspections.map((insp) => (
          <li key={insp.id} className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <p className="font-medium">
                {insp.type === "handover" ? "Entrega" : "Devolución"}
              </p>
              <p className="text-xs text-foreground/50">
                {formatDateTime(insp.createdAt)} · Responsable:{" "}
                {insp.user?.name ?? "—"}
              </p>
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <ClientEmailBadge inspection={insp} />
                {insp.actaAdminEmailStatus === "failed" && (
                  <Badge tone="red">Tampoco le llegó al admin</Badge>
                )}
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              <a
                className="font-medium underline"
                href={`/api/acta?inspectionId=${insp.id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Ver acta PDF
              </a>
              <ResendButton rentalId={rentalId} inspectionId={insp.id} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
