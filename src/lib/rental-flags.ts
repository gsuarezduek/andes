import type { Rental } from "@prisma/client";

type RentalFlagsInput = Pick<Rental, "status" | "origin" | "vehicleId"> & {
  inspections: { type: string }[];
};

export type RentalFlags = {
  canStartHandover: boolean;
  canStartReturn: boolean;
  canStartHandoverNow: boolean;
  canMarkService: boolean;
  canCloseService: boolean;
  canEditPickup: boolean;
  canEditReturn: boolean;
  canExtendRental: boolean;
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
  // "Volver a poner en servicio": mismo ícono/reserva que marcó el service,
  // disponible mientras el auto siga afuera — sin importar si tardó más o
  // menos de lo estimado.
  const canCloseService = rental.status === "out_of_service";
  // Editar hora/lugar de retiro: solo antes de que arranque el flujo físico
  // (el auto todavía no se entregó). Disponible para cualquier origen —
  // `updateRentalSchedule` marca `datesEditedAt`/`placesEditedAt` para que el
  // sync no vuelva a pisar lo editado a mano (mismo patrón que `clientEditedAt`).
  const canEditPickup = rental.status === "reserved";
  // Editar hora/lugar de devolución: reservado o ya entregado (antes de cerrar
  // la devolución). Igual que el retiro, para cualquier origen.
  const canEditReturn = rental.status === "reserved" || rental.status === "active";
  // Extender con cargo (ver `extendRental`): a diferencia de canEditReturn,
  // suma un cargo al contrato además de corregir la fecha — es el caso real
  // ("el cliente avisa y confirmamos si puede extender").
  const canExtendRental = rental.status === "active";

  return {
    canStartHandover,
    canStartReturn,
    canStartHandoverNow,
    canMarkService,
    canCloseService,
    canEditPickup,
    canEditReturn,
    canExtendRental,
  };
}
