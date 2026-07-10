import type { RentalStatus } from "@prisma/client";

/** Tono del badge según el estado del alquiler. */
export const rentalStatusTone: Record<
  RentalStatus,
  "amber" | "green" | "neutral" | "red"
> = {
  reserved: "amber",
  active: "green",
  finished: "neutral",
  cancelled: "red",
};
