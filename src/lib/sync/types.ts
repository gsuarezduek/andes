/**
 * Tipos compartidos del sync con VikRentCar (Fase 5).
 *
 * El motor de sincronización es agnóstico del transporte: consume un
 * `BookingSource` que devuelve reservas y modelos ya **normalizados** a esta
 * forma. Hay dos implementaciones intercambiables:
 *   - MySQL directo (`mysql-source.ts`) — para pruebas contra datos reales.
 *   - REST vía mu-plugin (`rest-source.ts`) — transporte de producción.
 *
 * Contra WordPress: SOLO lectura. Ver docs/wordpress-mapping.md.
 */

/** Estado crudo de una orden de VikRentCar. */
export type RawStatus = "confirmed" | "cancelled" | "standby" | (string & {});

/**
 * Una orden de VikRentCar, con el cliente ya resuelto (join a `customers` con
 * fallback a los campos de la propia orden). Timestamps en Unix segundos (UTC).
 */
export type RawBooking = {
  wpBookingId: number;
  status: RawStatus;
  /** Modelo (idcar) y unidad (carindex). `carindex` NULL → sin unidad asignada. */
  idcar: number | null;
  carindex: number | null;
  startUnix: number; // ritiro
  endUnix: number; // consegna
  createdUnix: number | null; // ts
  days: number | null;
  lang: string | null; // preselección de idioma (es/en)
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  clientDocNumber: string | null;
  // Datos económicos de la orden (referencia; ver docs/wordpress-mapping.md).
  custData: string | null; // custdata: info de la reserva (texto libre del staff)
  orderTotal: number | null; // order_total (con extras)
  carCost: number | null; // car_cost (tarifa del auto, sin extras)
};

/** Un modelo de `wp_vikrentcar_cars`, para el seed inicial de la flota. */
export type RawCar = {
  id: number; // → vehicles.wp_car_id
  name: string; // ej. "Renault Kwid Iconic 1.0"
  units: number; // cantidad de unidades físicas
};

/** Ventana temporal (Unix segundos) sobre la que se sincroniza. */
export type SyncWindow = { fromUnix: number; toUnix: number; includeStandby: boolean };

/** Fuente de reservas. Toda implementación es de SOLO lectura sobre WordPress. */
export interface BookingSource {
  readonly kind: "mysql" | "rest";
  /** Reservas cuyo retiro o devolución cae dentro de la ventana. */
  fetchBookings(window: SyncWindow): Promise<RawBooking[]>;
  /** Modelos de la flota (para el seed inicial de `vehicles`). */
  fetchCars(): Promise<RawCar[]>;
  /** Cierra conexiones abiertas (no-op en REST). */
  close?(): Promise<void>;
}
