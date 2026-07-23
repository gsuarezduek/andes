import { ButtonLink } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
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
  return (
    <div className="flex flex-wrap gap-3">
      <ButtonLink href={`/vehicles/${vehicleId}/edit`}>Editar</ButtonLink>
      {isAdmin && (
        <ButtonLink href={`/vehicles/${vehicleId}/qr`} variant="secondary">Imprimir QR</ButtonLink>
      )}
      <ButtonLink href="/vehicles" variant="secondary">Volver</ButtonLink>
      {isAdmin &&
        (archived ? (
          <form action={unarchiveVehicle.bind(null, vehicleId)} className="ml-auto">
            <SubmitButton variant="secondary" pendingLabel="Reactivando…">Reactivar</SubmitButton>
          </form>
        ) : hasActiveRental ? (
          <span className="ml-auto self-center text-xs text-foreground/50">
            Para archivar, cerrá primero la devolución del alquiler activo.
          </span>
        ) : (
          <form action={archiveVehicle.bind(null, vehicleId)} className="ml-auto">
            <SubmitButton variant="secondary" pendingLabel="Archivando…">Archivar</SubmitButton>
          </form>
        ))}
    </div>
  );
}
