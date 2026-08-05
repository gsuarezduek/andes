"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { Button } from "@/components/ui/button";
import { deleteRental } from "@/app/(app)/rentals/actions/delete";

export function DangerZoneSection({
  rentalId,
  clientName,
}: {
  rentalId: string;
  clientName: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function handleDelete() {
    setError(undefined);
    start(async () => {
      try {
        await deleteRental(rentalId);
      } catch (err) {
        unstable_rethrow(err);
        setError(err instanceof Error ? err.message : "No se pudo eliminar la reserva.");
      }
    });
  }

  return (
    <details className="rounded-xl border border-red-500/20">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-red-700 dark:text-red-400">
        Eliminar reserva
      </summary>
      <div className="flex flex-col gap-3 border-t border-red-500/20 p-4">
        <p className="text-xs text-foreground/60">
          Borra esta reserva de forma <strong>definitiva</strong>. Usalo para reservas que
          borraste en VikRentCar (quedaron huérfanas acá) o cargas manuales erróneas. No se
          puede deshacer. Una reserva con entrega/acta registrada no se puede eliminar.
        </p>
        {confirming ? (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
            <p className="text-sm text-red-700 dark:text-red-400">
              ¿Eliminar definitivamente la reserva de <strong>{clientName}</strong>? Esta acción
              no se puede deshacer.
            </p>
            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="text-xs text-foreground/50"
                disabled={pending}
              >
                Cancelar
              </button>
              <Button
                type="button"
                variant="danger"
                onClick={handleDelete}
                disabled={pending}
                className="ml-auto"
              >
                {pending ? "Eliminando…" : "Sí, eliminar definitivamente"}
              </Button>
            </div>
          </div>
        ) : (
          <Button type="button" variant="danger" onClick={() => setConfirming(true)}>
            Eliminar definitivamente
          </Button>
        )}
      </div>
    </details>
  );
}
