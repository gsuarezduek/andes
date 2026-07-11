import "server-only";
import mysql from "mysql2/promise";
import { env } from "@/lib/env";
import type { BookingSource, RawBooking, RawCar, SyncWindow } from "./types";

/**
 * Adaptador de solo lectura contra el MySQL de VikRentCar (Hostinger).
 * Pensado para pruebas locales contra datos reales. En producción se prefiere
 * el transporte REST (no expone el MySQL a internet). Ver docs/wordpress-mapping.md.
 *
 * Prefijo de tablas: `wp_vikrentcar_`. La resolución del cliente hace LEFT JOIN
 * a `customers` (preferido) y cae a los campos de la propia orden (77% de las
 * confirmadas no tienen `customers_orders`).
 */
const PREFIX = "wp_vikrentcar_";

type OrderRow = {
  id: number;
  status: string | null;
  idcar: number | null;
  carindex: number | null;
  ritiro: number | null;
  consegna: number | null;
  ts: number | null;
  days: number | null;
  lang: string | null;
  nominative: string | null;
  custmail: string | null;
  phone: string | null;
  c_first: string | null;
  c_last: string | null;
  c_email: string | null;
  c_phone: string | null;
  c_docnum: string | null;
};

type CarRow = { id: number; name: string | null; units: number | null };

function clean(v: string | null): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

export class MysqlBookingSource implements BookingSource {
  readonly kind = "mysql" as const;
  private pool: mysql.Pool | null = null;

  private getPool(): mysql.Pool {
    if (!this.pool) {
      const c = env.wpMysql;
      this.pool = mysql.createPool({
        host: c.host,
        port: c.port,
        database: c.database,
        user: c.user,
        password: c.password,
        connectionLimit: 2,
        // Solo lectura: no permitimos sentencias múltiples.
        multipleStatements: false,
        timezone: "Z",
      });
    }
    return this.pool;
  }

  async fetchBookings(window: SyncWindow): Promise<RawBooking[]> {
    const statuses = window.includeStandby
      ? ["confirmed", "cancelled", "standby"]
      : ["confirmed", "cancelled"];
    const placeholders = statuses.map(() => "?").join(", ");

    const sql = `
      SELECT o.id, o.status, o.idcar, o.carindex, o.ritiro, o.consegna, o.ts,
             o.days, o.lang, o.nominative, o.custmail, o.phone,
             c.first_name AS c_first, c.last_name AS c_last,
             c.email AS c_email, c.phone AS c_phone, c.docnum AS c_docnum
      FROM \`${PREFIX}orders\` o
      LEFT JOIN \`${PREFIX}customers_orders\` co ON co.idorder = o.id
      LEFT JOIN \`${PREFIX}customers\` c ON c.id = co.idcustomer
      WHERE o.status IN (${placeholders})
        AND (
          (o.ritiro BETWEEN ? AND ?) OR
          (o.consegna BETWEEN ? AND ?)
        )
      GROUP BY o.id
      ORDER BY o.id DESC`;

    const params = [
      ...statuses,
      window.fromUnix,
      window.toUnix,
      window.fromUnix,
      window.toUnix,
    ];
    const [rows] = await this.getPool().query<mysql.RowDataPacket[]>(sql, params);
    return (rows as OrderRow[]).map(normalizeOrder);
  }

  async fetchCars(): Promise<RawCar[]> {
    const sql = `SELECT id, name, units FROM \`${PREFIX}cars\` ORDER BY id`;
    const [rows] = await this.getPool().query<mysql.RowDataPacket[]>(sql);
    return (rows as CarRow[]).map((r) => ({
      id: r.id,
      name: clean(r.name) ?? `Modelo ${r.id}`,
      units: Math.max(1, r.units ?? 1),
    }));
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}

function normalizeOrder(r: OrderRow): RawBooking {
  const name =
    clean([r.c_first, r.c_last].filter(Boolean).join(" ")) ??
    clean(r.nominative) ??
    "Sin nombre";
  return {
    wpBookingId: r.id,
    status: (r.status ?? "").toLowerCase(),
    idcar: r.idcar ?? null,
    carindex: r.carindex ?? null,
    startUnix: r.ritiro ?? 0,
    endUnix: r.consegna ?? 0,
    createdUnix: r.ts ?? null,
    days: r.days ?? null,
    lang: clean(r.lang),
    clientName: name,
    clientEmail: clean(r.c_email) ?? clean(r.custmail),
    clientPhone: clean(r.c_phone) ?? clean(r.phone),
    clientDocNumber: clean(r.c_docnum),
  };
}
