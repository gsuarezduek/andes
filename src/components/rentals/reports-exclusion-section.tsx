"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/fields";
import { formatDateTime } from "@/lib/datetime";
import { setReportsExclusion } from "@/app/(app)/rentals/[id]/reports-exclusion-actions";

/**
 * "Excluir de reportes" (solo admin): la reserva deja de contar en las
 * métricas de alquileres de Reportes (finalizados, km, extras, ocupación,
 * reservas, por vehículo). Sirve para datos que distorsionan — un km mal
 * tipeado en una entrega ya firmada, una prueba — sin tocar la evidencia
 * inmutable ni Caja. Reversible.
 */
export function ReportsExclusionSection({
  rentalId,
  excluded,
}: {
  rentalId: string;
  excluded: { at: Date; reason: string | null; byName: string | null } | null;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function run(exclude: boolean) {
    setError(undefined);
    start(async () => {
      const res = await setReportsExclusion(rentalId, exclude, reason);
      if (res.error) setError(res.error);
      else setReason("");
    });
  }

  return (
    <details className={`rounded-xl border ${excluded ? "border-amber-500/40 bg-amber-500/5" : "border-foreground/10"}`} open={!!excluded}>
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
        {excluded ? "Excluida de Reportes" : "Excluir de Reportes"}
      </summary>
      <div className="flex flex-col gap-3 border-t border-foreground/10 p-4">
        {excluded ? (
          <>
            <p className="text-sm">
              Esta reserva <strong>no cuenta</strong> en las métricas de alquileres de Reportes.
            </p>
            <p className="text-xs text-foreground/60">
              Motivo: {excluded.reason || "—"}
              <br />
              {excluded.byName ? `Por ${excluded.byName} · ` : ""}
              {formatDateTime(excluded.at)}
            </p>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <Button type="button" variant="secondary" onClick={() => run(false)} disabled={pending} className="self-start">
              {pending ? "Guardando…" : "Volver a incluir en Reportes"}
            </Button>
          </>
        ) : (
          <>
            <p className="text-xs text-foreground/60">
              La reserva deja de contar en las métricas de alquileres de Reportes (finalizados, km, extras de la devolución,
              ocupación, reservas y &quot;por vehículo&quot;). Sirve para datos que distorsionan, como un km mal cargado en
              una entrega ya firmada. <strong>No modifica</strong> el acta firmada ni Caja, y se puede revertir.
            </p>
            <TextField
              id="reports-exclusion-reason"
              label="Motivo"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej.: km de entrega mal cargado (12.624 en vez de 126.4xx)"
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <Button type="button" onClick={() => run(true)} disabled={pending || reason.trim().length < 3} className="self-start">
              {pending ? "Guardando…" : "Excluir de Reportes"}
            </Button>
          </>
        )}
      </div>
    </details>
  );
}
