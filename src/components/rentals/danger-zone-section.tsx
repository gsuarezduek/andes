import { SubmitButton } from "@/components/ui/submit-button";
import { deleteRental } from "@/app/(app)/rentals/actions/delete";

export function DangerZoneSection({ rentalId }: { rentalId: string }) {
  return (
    <details className="rounded-xl border border-red-500/20">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-red-700 dark:text-red-400">
        Eliminar reserva
      </summary>
      <form
        action={deleteRental.bind(null, rentalId)}
        className="flex flex-col gap-3 border-t border-red-500/20 p-4"
      >
        <p className="text-xs text-foreground/60">
          Borra esta reserva de forma <strong>definitiva</strong>. Usalo para reservas que
          borraste en VikRentCar (quedaron huérfanas acá) o cargas manuales erróneas. No se
          puede deshacer. Una reserva con entrega/acta registrada no se puede eliminar.
        </p>
        <SubmitButton variant="danger" pendingLabel="Eliminando…">
          Eliminar definitivamente
        </SubmitButton>
      </form>
    </details>
  );
}
