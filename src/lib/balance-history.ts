/**
 * Reconstrucción pura de la evolución del saldo de una cuenta (día a día o
 * semana a semana) — Caja no guarda un "saldo de cada día", así que el
 * gráfico de Saldos → cuenta lo reconstruye sumando eventos firmados
 * (ingresos/egresos/traspasos) sobre el ajuste manual constante (ver
 * `PaymentMethod.balanceAdjustment*`). Sin "server-only": la usa tanto la
 * query de servidor (`getOwnAccountBalanceHistory` en `cash.ts`) como el
 * parseo de `?period=`/`?granularity=` de la página.
 */
import { formatDateInput } from "@/lib/datetime";
import { mondayOf, addDaysYmd } from "@/lib/cash-period";
import type { CurrencyTotals } from "@/lib/currency";

export type BalanceHistoryGranularity = "daily" | "weekly";
export type BalanceHistoryPeriod = "30d" | "60d" | "90d" | "12m";

export const BALANCE_HISTORY_PERIOD_OPTIONS: { value: BalanceHistoryPeriod; label: string; days: number }[] = [
  { value: "30d", label: "Últimos 30 días", days: 30 },
  { value: "60d", label: "Últimos 60 días", days: 60 },
  { value: "90d", label: "Últimos 90 días", days: 90 },
  { value: "12m", label: "Último año", days: 365 },
];

const DEFAULT_PERIOD: BalanceHistoryPeriod = "60d";

export function parseBalanceHistoryPeriod(raw: string | undefined): BalanceHistoryPeriod {
  return BALANCE_HISTORY_PERIOD_OPTIONS.some((o) => o.value === raw) ? (raw as BalanceHistoryPeriod) : DEFAULT_PERIOD;
}

export function balanceHistoryPeriodDays(period: BalanceHistoryPeriod): number {
  return BALANCE_HISTORY_PERIOD_OPTIONS.find((o) => o.value === period)!.days;
}

export function parseBalanceHistoryGranularity(raw: string | undefined): BalanceHistoryGranularity {
  return raw === "weekly" ? "weekly" : "daily";
}

/**
 * El período de 12 meses fuerza semanal — 365 puntos diarios es ruido visual
 * y recalcula de más. El resto respeta lo que haya elegido el usuario. Pura.
 */
export function resolveBalanceHistoryGranularity(
  period: BalanceHistoryPeriod,
  requested: BalanceHistoryGranularity,
): BalanceHistoryGranularity {
  return period === "12m" ? "weekly" : requested;
}

/** Un evento con delta firmado por moneda que ese movimiento/traspaso aporta al saldo de la cuenta. */
export type BalanceEvent = { date: Date; ars: number; usd: number };

/** Saldo al cierre de ese día ("YYYY-MM-DD", diario) o de esa semana (lunes, semanal). */
export type BalancePoint = { date: string; ars: number; usd: number };

function addDaysUtc(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

/**
 * Reconstruye la serie de saldo en [`from`, `to`] (ambos inclusive, hora
 * Mendoza) a partir de `events` — que puede (y conviene) incluir eventos
 * anteriores a `from`: hacen falta para que el primer punto ya arranque con
 * el saldo real acumulado, no desde cero. `adjustment` es el ajuste manual
 * constante, que se suma siempre (no tiene fecha propia). Pura y testeable.
 */
export function buildBalanceHistory(
  events: BalanceEvent[],
  adjustment: CurrencyTotals,
  from: Date,
  to: Date,
  granularity: BalanceHistoryGranularity,
): BalancePoint[] {
  // Delta por día calendario (Mendoza), sin importar la granularidad de
  // salida — la agregación semanal se hace al recorrer los buckets, no acá.
  const deltaByDay = new Map<string, { ars: number; usd: number }>();
  for (const e of events) {
    const key = formatDateInput(e.date);
    const acc = deltaByDay.get(key) ?? { ars: 0, usd: 0 };
    acc.ars += e.ars;
    acc.usd += e.usd;
    deltaByDay.set(key, acc);
  }
  const eventDays = [...deltaByDay.keys()].sort();

  const fromYmd = formatDateInput(from);
  const toYmd = formatDateInput(to);

  // Buckets a mostrar: diario = un día cada uno; semanal = de lunes a
  // domingo, con el último recortado a `to` si todavía no termina.
  const buckets: { label: string; endYmd: string }[] = [];
  if (granularity === "daily") {
    for (let cursor = fromYmd; cursor <= toYmd; cursor = addDaysYmd(cursor, 1)) {
      buckets.push({ label: cursor, endYmd: cursor });
    }
  } else {
    for (let weekStart = mondayOf(fromYmd); weekStart <= toYmd; weekStart = addDaysYmd(weekStart, 7)) {
      const weekEnd = addDaysYmd(weekStart, 6);
      buckets.push({ label: weekStart, endYmd: weekEnd < toYmd ? weekEnd : toYmd });
    }
  }

  // Merge-walk: saldo corriente, consumiendo eventos (ordenados) hasta el
  // final de cada bucket — incluye de arranque todo lo anterior a `from`.
  let running = { ars: adjustment.ars, usd: adjustment.usd };
  let ptr = 0;
  const points: BalancePoint[] = [];
  for (const bucket of buckets) {
    while (ptr < eventDays.length && eventDays[ptr] <= bucket.endYmd) {
      const d = deltaByDay.get(eventDays[ptr])!;
      running = { ars: running.ars + d.ars, usd: running.usd + d.usd };
      ptr++;
    }
    points.push({ date: bucket.label, ars: running.ars, usd: running.usd });
  }
  return points;
}

/** `from` (hora Mendoza) para un período de `days` días terminando en `to`. Pura. */
export function balanceHistoryFrom(to: Date, days: number): Date {
  return addDaysUtc(to, -(days - 1));
}
