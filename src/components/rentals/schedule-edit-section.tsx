import { formatDateTimeInput } from "@/lib/datetime";
import { EditScheduleForm } from "@/app/(app)/rentals/[id]/edit-schedule-form";
import type { RentalDetail } from "@/lib/rental-detail-queries";

export function ScheduleEditSection({
  rental,
  canEditPickup,
  canEditReturn,
}: {
  rental: RentalDetail;
  canEditPickup: boolean;
  canEditReturn: boolean;
}) {
  if (!canEditReturn) return null;

  return (
    <EditScheduleForm
      rentalId={rental.id}
      canEditPickup={canEditPickup}
      startAt={formatDateTimeInput(rental.startAt)}
      pickupPlace={rental.bookingPickupPlace ?? ""}
      endAt={formatDateTimeInput(rental.endAt)}
      returnPlace={rental.bookingReturnPlace ?? ""}
      isActive={rental.status === "active"}
    />
  );
}
