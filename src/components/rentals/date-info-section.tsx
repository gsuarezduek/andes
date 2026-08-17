import { Row } from "@/components/ui/row";
import { languageLabels } from "@/lib/labels";
import { formatDateTime } from "@/lib/datetime";
import type { RentalDetail } from "@/lib/rental-detail-queries";

export function DateInfoSection({ rental }: { rental: RentalDetail }) {
  // Cuándo "entró" la reserva: si vino de VikRentCar, la hora real en que se
  // cargó ahí (bookingCreatedAt); si no hay ese dato (alquiler manual, o
  // reserva sincronizada antes de que existiera este campo), cae a cuándo
  // Andes la creó — que para una reserva de VikRentCar es cuándo la trajo el
  // sync por primera vez.
  const enteredAt = rental.bookingCreatedAt ?? rental.createdAt;

  return (
    <div className="divide-y divide-foreground/10 rounded-xl border border-foreground/10 px-4">
      <Row label="Reserva cargada" value={formatDateTime(enteredAt)} />
      <Row label="Retiro" value={formatDateTime(rental.startAt)} />
      {rental.bookingPickupPlace && (
        <Row label="Lugar de retiro" value={rental.bookingPickupPlace} />
      )}
      <Row label="Devolución" value={formatDateTime(rental.endAt)} />
      {rental.bookingReturnPlace && (
        <Row label="Lugar de devolución" value={rental.bookingReturnPlace} />
      )}
      <Row label="Idioma" value={languageLabels[rental.language]} />
      <Row label="Método de pago" value={rental.bookingPaymentMethod} />
    </div>
  );
}
