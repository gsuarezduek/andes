"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { VerifiedIcon } from "@/components/ui/icons";
import { formatDateTime } from "@/lib/datetime";
import { verifyRental, unverifyRental } from "@/app/(app)/rentals/[id]/verification-actions";

export type VerificationEvent = {
  id: string;
  action: "verified" | "unverified" | "auto_unverified";
  reason: string | null;
  byName: string;
  createdAt: Date;
};

const eventLabel: Record<VerificationEvent["action"], string> = {
  verified: "Verificada",
  unverified: "Verificación quitada",
  auto_unverified: "Verificación quitada automáticamente",
};

/**
 * Verificación de la reserva por un admin: "revisé todo, los pagos están donde
 * deben". Todos los roles ven el estado (y el calendario lo marca con un
 * tilde); solo el admin puede verificar/quitar y ve el historial. Si después
 * cambia algo de plata, el sistema la desverifica sola (`autoUnverifyRental`).
 * Solo se renderiza para reservas verificables (ver `canVerifyRental`).
 */
export function RentalVerificationSection({
  rentalId,
  verified,
  isAdmin,
  history,
}: {
  rentalId: string;
  verified: { byName: string | null; at: Date } | null;
  isAdmin: boolean;
  history: VerificationEvent[];
}) {
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function run(action: (id: string) => Promise<{ error?: string }>) {
    setError(undefined);
    start(async () => {
      const res = await action(rentalId);
      if (res.error) setError(res.error);
      setConfirmingRemove(false);
    });
  }

  return (
    <section
      className={`flex flex-col gap-3 rounded-xl border p-4 ${
        verified ? "border-emerald-500/40 bg-emerald-500/5" : "border-foreground/10 bg-foreground/[0.03]"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          {verified ? (
            <>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                <VerifiedIcon className="size-4" /> Verificada
              </p>
              <p className="text-xs text-foreground/60">
                {verified.byName ? `por ${verified.byName} · ` : ""}
                {formatDateTime(verified.at)}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-foreground/70">Sin verificar</p>
              <p className="text-xs text-foreground/50">Un admin todavía no revisó esta reserva.</p>
            </>
          )}
        </div>

        {isAdmin && !verified && (
          <Button type="button" disabled={pending} onClick={() => run(verifyRental)} className="shrink-0">
            {pending ? "Verificando…" : "Verificar reserva"}
          </Button>
        )}
        {isAdmin && verified && !confirmingRemove && (
          <Button type="button" variant="secondary" onClick={() => setConfirmingRemove(true)} className="shrink-0">
            Quitar
          </Button>
        )}
      </div>

      {isAdmin && verified && confirmingRemove && (
        <div className="flex flex-col gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
          <p className="text-sm">¿Quitar la verificación de esta reserva? Queda registrado en el historial.</p>
          <div className="flex gap-2">
            <Button type="button" variant="danger" disabled={pending} onClick={() => run(unverifyRental)} className="flex-1">
              Sí, quitar
            </Button>
            <Button type="button" variant="secondary" disabled={pending} onClick={() => setConfirmingRemove(false)} className="flex-1">
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-xs font-medium text-red-600">{error}</p>}

      {isAdmin && history.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-foreground/60">Historial de verificación ({history.length})</summary>
          <ul className="mt-2 flex flex-col gap-1.5">
            {history.map((h) => (
              <li key={h.id} className="rounded-md bg-foreground/[0.04] px-2 py-1.5">
                <p className="font-medium">
                  {eventLabel[h.action]} · {h.byName}
                </p>
                <p className="text-foreground/50">{formatDateTime(h.createdAt)}</p>
                {h.reason && <p className="text-foreground/70">{h.reason}</p>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
