import "server-only";
import { env } from "@/lib/env";
import type { BookingSource } from "./types";
import { RestBookingSource } from "./rest-source";
import { MysqlBookingSource } from "./mysql-source";

/**
 * Elige el transporte de sincronización. En producción se prefiere REST
 * (mu-plugin, no expone el MySQL). El MySQL directo queda como fallback para
 * pruebas locales contra datos reales. Si ninguno está configurado, lanza.
 */
export function createBookingSource(): BookingSource {
  if (env.hasWpRest) return new RestBookingSource();
  if (env.hasWpMysql) return new MysqlBookingSource();
  throw new Error(
    "Sync sin transporte configurado: definí WP_REST_URL (prod) o WP_MYSQL_* (pruebas).",
  );
}
