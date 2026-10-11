/**
 * Código corto de 3 letras para un lugar de retiro/devolución de VikRentCar
 * (`Rental.bookingPickupPlace`/`bookingReturnPlace`, texto libre que llega de
 * `wp_vikrentcar_places.name` — ej. "Oficina Mendoza Ciudad", "Aeropuerto
 * Mendoza Auto", "Hotel en Ciudad de Mendoza Auto"). No hay un catálogo
 * estructurado del lado de VikRentCar (son 7 filas de texto libre), así que
 * se clasifica por palabra clave — es lo único estable para distinguir de un
 * vistazo en el Calendario. `null` si no hay dato: no se inventa un "otros"
 * cuando VikRentCar no trajo el lugar (reserva manual, o el sync con el toggle
 * `share_booking_extra` apagado del lado del plugin de WordPress).
 */
export type PlaceCode = "OFI" | "AER" | "HOT" | "OTR";

export function placeCode(place: string | null | undefined): PlaceCode | null {
  const normalized = place?.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.includes("aeropuerto")) return "AER";
  if (normalized.includes("oficina")) return "OFI";
  if (normalized.includes("hotel")) return "HOT";
  return "OTR";
}
