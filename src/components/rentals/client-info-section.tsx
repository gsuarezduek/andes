import Link from "next/link";
import { Row } from "@/components/ui/row";
import { EditDetailsForm } from "@/app/(app)/rentals/[id]/edit-details-form";
import { vehicleLabelWithPlate } from "@/lib/vehicle-ui";
import type { RentalDetail } from "@/lib/rental-detail-queries";

export function ClientInfoSection({
  rental,
  canStartHandover,
  editableVehicles,
}: {
  rental: RentalDetail;
  canStartHandover: boolean;
  editableVehicles: { id: string; plate: string; name: string | null; brand: string; model: string }[];
}) {
  if (canStartHandover) {
    return (
      <EditDetailsForm
        rentalId={rental.id}
        clientName={rental.clientName}
        clientEmail={rental.clientEmail ?? ""}
        clientPhone={rental.clientPhone ?? ""}
        clientDocNumber={rental.clientDocNumber ?? ""}
        clientAddress={rental.clientAddress ?? ""}
        vehicleId={rental.vehicleId ?? ""}
        vehicles={editableVehicles.map((v) => ({
          id: v.id,
          label: vehicleLabelWithPlate(v),
        }))}
      />
    );
  }
  return (
    <div className="divide-y divide-foreground/10 rounded-xl border border-foreground/10 px-4">
      <Row label="Email" value={rental.clientEmail} />
      <Row label="Teléfono" value={rental.clientPhone} />
      <Row label="Documento" value={rental.clientDocNumber} />
      <Row label="Domicilio" value={rental.clientAddress} />
      <Row
        label="Vehículo"
        value={
          rental.vehicle ? (
            <Link className="underline" href={`/vehicles/${rental.vehicle.id}`}>
              {vehicleLabelWithPlate(rental.vehicle)}
            </Link>
          ) : rental.bookingModel ? (
            <span>
              {rental.bookingModel}
              <span className="font-normal text-foreground/50"> · sin unidad asignada</span>
            </span>
          ) : (
            "Sin asignar"
          )
        }
      />
    </div>
  );
}
