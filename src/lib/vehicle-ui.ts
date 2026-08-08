import type { VehicleStatus } from "@prisma/client";

/** Tono del badge según el estado del vehículo. */
export const vehicleStatusTone: Record<
  VehicleStatus,
  "emerald" | "blue" | "amber"
> = {
  available: "emerald",
  rented: "blue",
  out_of_service: "amber",
};
