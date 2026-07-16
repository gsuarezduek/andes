import "server-only";
import mysql from "mysql2/promise";
import { env } from "@/lib/env";
import type { BookingSource, RawBooking, RawCar, RawOptional, RawSeason, SyncWindow } from "./types";
import { parseIdCars } from "./rates";

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
  custdata: string | null;
  country: string | null;
  order_total: string | number | null;
  totpaid: string | number | null;
  car_cost: string | number | null;
  car_name: string | null;
  pickup_place: string | null;
  return_place: string | null;
  optionals: string | null;
  idpayment: string | null;
  c_first: string | null;
  c_last: string | null;
  c_email: string | null;
  c_phone: string | null;
  c_docnum: string | null;
};

type CarRow = { id: number; name: string | null; units: number | null; base1: string | number | null };
type SeasonRow = {
  from: number | null;
  to: number | null;
  year: number | null;
  diffcost: string | number | null;
  idcars: string | null;
};

function clean(v: string | null): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/** Decimal de MySQL (llega como string) → number, o null. */
function num(v: string | number | null): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** idpayment de VikRentCar ("1=Transferencia de Banco") → "Transferencia de Banco". */
export function paymentMethodName(v: string | null): string | null {
  const t = clean(v);
  if (t == null) return null;
  const eq = t.indexOf("=");
  const name = eq >= 0 ? t.slice(eq + 1).trim() : t;
  return name.length > 0 ? name : null;
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
             o.custdata, o.country, o.order_total, o.totpaid, o.car_cost, o.optionals,
             o.idpayment,
             car.name AS car_name, pp.name AS pickup_place, rp.name AS return_place,
             c.first_name AS c_first, c.last_name AS c_last,
             c.email AS c_email, c.phone AS c_phone, c.docnum AS c_docnum
      FROM \`${PREFIX}orders\` o
      LEFT JOIN \`${PREFIX}customers_orders\` co ON co.idorder = o.id
      LEFT JOIN \`${PREFIX}customers\` c ON c.id = co.idcustomer
      LEFT JOIN \`${PREFIX}cars\` car ON car.id = o.idcar
      LEFT JOIN \`${PREFIX}places\` pp ON pp.id = o.idplace
      LEFT JOIN \`${PREFIX}places\` rp ON rp.id = o.idreturnplace
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
    const sql = `SELECT c.id, c.name, c.units,
        (SELECT MIN(d.cost) FROM \`${PREFIX}dispcost\` d WHERE d.idcar = c.id AND d.days = 1) AS base1
      FROM \`${PREFIX}cars\` c ORDER BY c.id`;
    const [rows] = await this.getPool().query<mysql.RowDataPacket[]>(sql);
    return (rows as CarRow[]).map((r) => ({
      id: r.id,
      name: clean(r.name) ?? `Modelo ${r.id}`,
      units: Math.max(1, r.units ?? 1),
      baseDailyRate: num(r.base1),
    }));
  }

  async fetchSeasons(): Promise<RawSeason[]> {
    // Solo temporadas de ajuste porcentual (type=1, val_pcent=2): las que usa MDZ.
    const sql = `SELECT \`from\`, \`to\`, year, diffcost, idcars
      FROM \`${PREFIX}seasons\` WHERE type = 1 AND val_pcent = 2`;
    const [rows] = await this.getPool().query<mysql.RowDataPacket[]>(sql);
    return (rows as SeasonRow[])
      .filter((r) => r.from != null && r.to != null)
      .map((r) => ({
        from: r.from as number,
        to: r.to as number,
        year: r.year ?? null,
        diffPercent: num(r.diffcost) ?? 0,
        idcars: parseIdCars(r.idcars),
      }));
  }

  async fetchOptionals(): Promise<RawOptional[]> {
    const sql = `SELECT id, name, cost, perday, hmany FROM \`${PREFIX}optionals\` ORDER BY ordering, id`;
    const [rows] = await this.getPool().query<mysql.RowDataPacket[]>(sql);
    return (rows as OptionalRow[]).map((r) => ({
      id: r.id,
      name: clean(r.name) ?? `Opcional ${r.id}`,
      cost: num(r.cost),
      perDay: Number(r.perday) === 1,
      hasMany: Number(r.hmany) === 1,
    }));
  }

  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}

type OptionalRow = {
  id: number;
  name: string | null;
  cost: string | number | null;
  perday: number | null;
  hmany: number | null;
};

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
    clientCountry: clean(r.country),
    custData: clean(r.custdata),
    orderTotal: num(r.order_total),
    paid: num(r.totpaid),
    carCost: num(r.car_cost),
    carName: clean(r.car_name),
    pickupPlace: clean(r.pickup_place),
    returnPlace: clean(r.return_place),
    optionals: clean(r.optionals),
    paymentMethod: paymentMethodName(r.idpayment),
  };
}
