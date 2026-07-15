import "server-only";
import { env } from "@/lib/env";
import type { BookingSource, RawBooking, RawCar, RawOptional, RawSeason, SyncWindow } from "./types";

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
    // `clientName` es NOT NULL en el modelo. El plugin puede mandarlo null si el
    // admin apagó el grupo "Cliente" en sus ajustes; usamos el mismo placeholder
    // que el adaptador MySQL para que el sync no falle.
    return (data.bookings ?? []).map((b) => ({
      ...b,
      clientName: b.clientName ?? "Sin nombre",
      // Compat con plugins < v1.4.0 que no devuelven `optionals`.
      optionals: b.optionals ?? null,
    }));
  }

  async fetchCars(): Promise<RawCar[]> {
    const data = await this.get<{ cars: RawCar[] }>("cars");
    // Compat con mu-plugins viejos que no devuelven baseDailyRate.
    return (data.cars ?? []).map((c) => ({ ...c, baseDailyRate: c.baseDailyRate ?? null }));
  }

  async fetchSeasons(): Promise<RawSeason[]> {
    // Compat: si el mu-plugin no tiene el endpoint (404), no hay ajuste de temporada.
    try {
      const data = await this.get<{ seasons: RawSeason[] }>("seasons");
      return data.seasons ?? [];
    } catch {
      return [];
    }
  }

  async fetchOptionals(): Promise<RawOptional[]> {
    // Compat: si el plugin es < v1.4.0 (sin /optionals, 404), no hay catálogo.
    try {
      const data = await this.get<{ optionals: RawOptional[] }>("optionals");
      return data.optionals ?? [];
    } catch {
      return [];
    }
  }
}
