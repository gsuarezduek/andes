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

type VehicleNameFields = { name?: string | null; brand: string; model: string };
type VehiclePlateFields = VehicleNameFields & { plate: string };

/**
 * Referencia principal del auto: el apodo cargado en la ficha si existe,
 * si no marca+modelo. Usar en cualquier lugar donde antes se armaba
 * `${brand} ${model}` a mano — es la fuente única de esta regla en toda la app.
 */
export function vehicleDisplayName(v: VehicleNameFields): string {
  return v.name?.trim() || `${v.brand} ${v.model}`;
}

/** Igual que `vehicleDisplayName`, con la patente al lado (formato unificado
 *  "Referencia · PATENTE" para pickers y listados que necesitan las dos cosas). */
export function vehicleLabelWithPlate(v: VehiclePlateFields): string {
  return `${vehicleDisplayName(v)} · ${v.plate}`;
}
