import "server-only";
import { env } from "@/lib/env";
import type { BookingSource, RawBooking, RawCar, SyncWindow } from "./types";

/**
 * Transporte de producción: consume el mu-plugin `andes-sync` de WordPress por
 * REST (HTTPS + token). No expone el MySQL a internet. El plugin hace los SELECT
 * y devuelve las reservas y modelos ya normalizados a `RawBooking` / `RawCar`.
 * Ver wordpress-plugin/andes-sync.php.
 */
export class RestBookingSource implements BookingSource {
  readonly kind = "rest" as const;

  private async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const { url, token } = env.wpRest;
    const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
    const res = await fetch(`${url.replace(/\/$/, "")}/${path}${qs}`, {
      headers: { "X-Andes-Token": token, Accept: "application/json" },
      cache: "no-store",
      // El sync nunca debe colgar la app: timeout defensivo.
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`WP REST ${path} → ${res.status} ${res.statusText} ${body.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  }

  async fetchBookings(window: SyncWindow): Promise<RawBooking[]> {
    const data = await this.get<{ bookings: RawBooking[] }>("bookings", {
      from: String(window.fromUnix),
      to: String(window.toUnix),
      include_standby: window.includeStandby ? "1" : "0",
    });
    return data.bookings ?? [];
  }

  async fetchCars(): Promise<RawCar[]> {
    const data = await this.get<{ cars: RawCar[] }>("cars");
    return data.cars ?? [];
  }
}
