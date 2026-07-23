import type { Rental } from "@prisma/client";

type RentalFlagsInput = Pick<Rental, "status" | "origin" | "vehicleId"> & {
  inspections: { type: string }[];
};

export type RentalFlags = {
  canStartHandover: boolean;
  canStartReturn: boolean;
  canStartHandoverNow: boolean;
  canMarkService: boolean;
  canEditReturn: boolean;
  returnManagedInWp: boolean;
};

export function computeRentalFlags(rental: RentalFlagsInput): RentalFlags {
  const handover = rental.inspections.find((i) => i.type === "handover");
  const returnInsp = rental.inspections.find((i) => i.type === "return_");
  const canStartHandover = rental.status === "reserved" && !handover;
  const canStartReturn = rental.status === "active" && Boolean(handover) && !returnInsp;
  // Requerimos un vehículo asignado para iniciar la entrega (el wizard ya no lo pide).
  const canStartHandoverNow = canStartHandover && Boolean(rental.vehicleId);
  // Marcar service/arreglo en vez de entregar: para alquileres cargados solo
  // para bloquear el auto (reservado, con unidad, sin entrega hecha).
  const canMarkService = canStartHandover && Boolean(rental.vehicleId);
  // Extensión: modificar fecha/lugar de devolución mientras no esté cerrado.
  // La edición de fechas solo se permite en reservas manuales. Las de VikRentCar
  // se gestionan desde la web (fuente de verdad) y se sincronizan solas: editarlas
  // acá dejaría la disponibilidad de VikRentCar inconsistente.
  const canEditReturn =
    rental.origin === "manual" &&
    (rental.status === "reserved" || rental.status === "active");
  const returnManagedInWp =
    rental.origin === "vikrentcar" &&
    (rental.status === "reserved" || rental.status === "active");

  return { canStartHandover, canStartReturn, canStartHandoverNow, canMarkService, canEditReturn, returnManagedInWp };
}
