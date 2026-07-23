import { formatDateTimeInput } from "@/lib/datetime";
import { EditReturnForm } from "@/app/(app)/rentals/[id]/edit-return-form";
import type { RentalDetail } from "@/lib/rental-detail-queries";

export function ReturnEditSection({
  rental,
  canEditReturn,
  returnManagedInWp,
}: {
  rental: RentalDetail;
  canEditReturn: boolean;
  returnManagedInWp: boolean;
}) {
  return (
    <>
      {canEditReturn && (
        <EditReturnForm
          rentalId={rental.id}
          endAt={formatDateTimeInput(rental.endAt)}
          returnPlace={rental.bookingReturnPlace ?? ""}
        />
      )}

      {returnManagedInWp && (
        <p className="rounded-xl border border-foreground/10 px-4 py-3 text-sm text-foreground/60">
          Las fechas de esta reserva se gestionan desde VikRentCar (la web). Si el
          cliente extiende el alquiler, cambiá la fecha allí y se sincroniza sola.
        </p>
      )}
    </>
  );
}
