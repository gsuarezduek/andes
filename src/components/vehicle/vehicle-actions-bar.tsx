"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { ButtonLink, Button } from "@/components/ui/button";
import { archiveVehicle, unarchiveVehicle } from "@/app/(app)/vehicles/actions";

export function VehicleActionsBar({
  vehicleId,
  isAdmin,
  archived,
  hasActiveRental,
}: {
  vehicleId: string;
  isAdmin: boolean;
  archived: boolean;
  hasActiveRental: boolean;
}) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function run(action: (id: string) => Promise<void>) {
    setError(undefined);
    start(async () => {
      try {
        await action(vehicleId);
      } catch (err) {
        unstable_rethrow(err);
        setError(err instanceof Error ? err.message : "No se pudo completar la acción.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-3">
        <ButtonLink href={`/vehicles/${vehicleId}/edit`}>Editar</ButtonLink>
        {isAdmin && (
          <ButtonLink href={`/vehicles/${vehicleId}/qr`} variant="secondary">Imprimir QR</ButtonLink>
        )}
        <ButtonLink href="/vehicles" variant="secondary">Volver</ButtonLink>
        {isAdmin &&
          (archived ? (
            <Button
              type="button"
              variant="secondary"
              className="ml-auto"
              disabled={pending}
              onClick={() => run(unarchiveVehicle)}
            >
              {pending ? "Reactivando…" : "Reactivar"}
            </Button>
          ) : hasActiveRental ? (
            <span className="ml-auto self-center text-xs text-foreground/50">
              Para archivar, cerrá primero la devolución del alquiler activo.
            </span>
          ) : (
            <Button
              type="button"
              variant="secondary"
              className="ml-auto"
              disabled={pending}
              onClick={() => run(archiveVehicle)}
            >
              {pending ? "Archivando…" : "Archivar"}
            </Button>
          ))}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
