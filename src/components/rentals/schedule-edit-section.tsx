import { formatDateTimeInput } from "@/lib/datetime";
import { EditScheduleForm } from "@/app/(app)/rentals/[id]/edit-schedule-form";
import type { RentalDetail } from "@/lib/rental-detail-queries";

export function ScheduleEditSection({
  rental,
  canEditPickup,
  canEditReturn,
  bookingInfo,
}: {
  rental: RentalDetail;
  canEditPickup: boolean;
  canEditReturn: boolean;
  /** Alquiler manual de un auto de tercero: suma método de pago e idioma, y
   *  los lugares se eligen de la lista de la web. */
  bookingInfo?: { placeOptions: string[]; paymentOptions: string[] };
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
      bookingInfo={
        bookingInfo && {
          ...bookingInfo,
          paymentMethod: rental.bookingPaymentMethod ?? "",
          language: rental.language,
        }
      }
    />
  );
}
