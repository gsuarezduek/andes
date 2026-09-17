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

/**
 * Marca + modelo, sin el apodo interno de la ficha. Para cara al cliente
 * (bot de WhatsApp, actas, emails): el nombre que carga el dueño en la ficha
 * es referencia interna del equipo (a veces un código de flota, un color, un
 * número), no algo que un cliente reconozca o deba ver.
 */
export function vehicleBrandModel(v: { brand: string; model: string }): string {
  return `${v.brand} ${v.model}`;
}

/** Igual que `vehicleDisplayName`, con la patente al lado (formato unificado
 *  "Referencia · PATENTE" para pickers y listados que necesitan las dos cosas). */
export function vehicleLabelWithPlate(v: VehiclePlateFields): string {
  return `${vehicleDisplayName(v)} · ${v.plate}`;
}
