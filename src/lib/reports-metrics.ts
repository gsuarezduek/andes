/**
 * Cálculos puros (sin DB ni React) de las métricas de negocio de Reportes:
 * ocupación, extras de la devolución, anticipación de las reservas y tiempo
 * de respuesta de WhatsApp. `getReports` (reports.ts) trae los datos y los
 * pasa por acá; se separan para poder testearlos sin base.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

/** Mediana de una lista (no muta la entrada); null si está vacía. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Promedio de una lista; null si está vacía. */
export function average(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((s, v) => s + v, 0) / values.length;
}

// ---------------------------------------------------------------------------
// Ocupación de la flota
// ---------------------------------------------------------------------------

export type OccupancyInterval = { vehicleId: string; start: Date; end: Date };

export type OccupancySummary = {
  // Días alquilados / días disponibles (flota × días del período). null si no hay flota o período.
  percent: number | null;
  rentedDays: number;
  availableDays: number;
  fleetUnits: number;
};

/** Días (con decimales) que [start, end) se superpone con el período [pStart, pEnd). */
export function overlapDays(start: Date, end: Date, pStart: Date, pEnd: Date): number {
  const from = Math.max(start.getTime(), pStart.getTime());
  const to = Math.min(end.getTime(), pEnd.getTime());
  return Math.max(0, to - from) / DAY_MS;
}

/**
 * Ocupación: días que cada auto estuvo alquilado dentro del período (desde la
 * entrega hasta la devolución, o hasta hoy si sigue activo) sobre los días
 * disponibles. El total cuenta solo la flota operativa (`fleetVehicleIds`,
 * sin archivados); `byVehicle` da el % de cada auto (incluye archivados que
 * hayan alquilado). Los días de un mismo auto se topean al largo del período
 * para que dos alquileres superpuestos no lo pasen del 100%. Pura y testeable.
 */
export function computeOccupancy(
  intervals: OccupancyInterval[],
  fleetVehicleIds: string[],
  pStart: Date,
  pEnd: Date,
): { summary: OccupancySummary; byVehicle: Map<string, number> } {
  const periodDays = Math.max(0, pEnd.getTime() - pStart.getTime()) / DAY_MS;
  const rentedByVehicle = new Map<string, number>();
  for (const i of intervals) {
    const days = overlapDays(i.start, i.end, pStart, pEnd);
    if (days > 0) rentedByVehicle.set(i.vehicleId, (rentedByVehicle.get(i.vehicleId) ?? 0) + days);
  }

  const byVehicle = new Map<string, number>();
  for (const [id, days] of rentedByVehicle) {
    const capped = Math.min(days, periodDays);
    rentedByVehicle.set(id, capped);
    byVehicle.set(id, periodDays > 0 ? (capped / periodDays) * 100 : 0);
  }

  const fleet = new Set(fleetVehicleIds);
  let rentedDays = 0;
  for (const [id, days] of rentedByVehicle) if (fleet.has(id)) rentedDays += days;
  const availableDays = fleet.size * periodDays;

  return {
    summary: {
      percent: availableDays > 0 ? (rentedDays / availableDays) * 100 : null,
      rentedDays,
      availableDays,
      fleetUnits: fleet.size,
    },
    byVehicle,
  };
}

// ---------------------------------------------------------------------------
// Extras de la devolución (liquidación)
// ---------------------------------------------------------------------------

export type SettlementExtras = { km: number; fuel: number; damages: number; total: number };

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/**
 * Lo que la devolución liquidó aparte de la tarifa: km extra, nafta y daños
 * (los tres cargos de `Settlement`). El JSON puede faltar (devoluciones
 * anteriores a la liquidación) → todo en 0. Tolerante a campos ausentes.
 */
export function settlementExtras(settlement: unknown): SettlementExtras {
  const s = (settlement ?? {}) as Record<string, unknown>;
  const km = num(s.extraKmCharge);
  const fuel = num(s.fuelCharge);
  const damages = num(s.damagesTotal);
  return { km, fuel, damages, total: km + fuel + damages };
}

// ---------------------------------------------------------------------------
// Anticipación de las reservas
// ---------------------------------------------------------------------------

export type LeadTimeBucket = { label: string; count: number };

export type LeadTimeSummary = {
  // Reservas con fecha de carga conocida (solo las importadas de VikRentCar).
  withData: number;
  averageDays: number | null;
  medianDays: number | null;
  buckets: LeadTimeBucket[];
};

const LEAD_TIME_BUCKETS: { label: string; max: number }[] = [
  { label: "Mismo día", max: 0 },
  { label: "1 a 3 días", max: 3 },
  { label: "4 a 7 días", max: 7 },
  { label: "8 a 30 días", max: 30 },
  { label: "Más de 30 días", max: Infinity },
];

/** Días de antelación entre que se cargó la reserva y el retiro (nunca negativo). */
export function leadTimeDays(startAt: Date, bookingCreatedAt: Date): number {
  return Math.max(0, (startAt.getTime() - bookingCreatedAt.getTime()) / DAY_MS);
}

export function summarizeLeadTimes(days: number[]): LeadTimeSummary {
  const buckets = LEAD_TIME_BUCKETS.map((b) => ({ label: b.label, count: 0 }));
  for (const d of days) {
    const whole = Math.floor(d);
    const idx = LEAD_TIME_BUCKETS.findIndex((b) => whole <= b.max);
    buckets[idx].count += 1;
  }
  return { withData: days.length, averageDays: average(days), medianDays: median(days), buckets };
}

// ---------------------------------------------------------------------------
// Tiempo de respuesta en WhatsApp
// ---------------------------------------------------------------------------

export type ResponseMessage = {
  conversationId: string;
  direction: "in" | "out";
  createdAt: Date;
  sentByBot: boolean;
};

export type ResponseWait = { minutes: number; byBot: boolean };

export type ResponseTimeSummary = {
  // Esperas medidas: mensaje del cliente (que abre una espera) → siguiente mensaje saliente.
  waits: number;
  medianMinutes: number | null;
  averageMinutes: number | null;
  // Solo las esperas en que contestó una persona (no el bot).
  humanWaits: number;
  humanMedianMinutes: number | null;
  // Esperas que empezaron en el período y todavía no tienen ninguna respuesta.
  unanswered: number;
};

/**
 * Cada vez que el cliente escribe después de una respuesta nuestra (o al
 * abrir la conversación) empieza una espera, que termina en el siguiente
 * mensaje saliente — del bot, del equipo desde Andes o desde la app de
 * WhatsApp. Varios mensajes seguidos del cliente son una sola espera (cuenta
 * desde el primero). Solo se miden las esperas que EMPIEZAN dentro de
 * [pStart, pEnd); la respuesta puede caer después. Pura y testeable: los
 * mensajes tienen que traer suficiente historial anterior a `pStart` para
 * saber si la primera espera ya venía abierta.
 */
export function computeResponseWaits(
  messages: ResponseMessage[],
  pStart: Date,
  pEnd: Date,
): { waits: ResponseWait[]; unanswered: number } {
  const byConversation = new Map<string, ResponseMessage[]>();
  for (const m of messages) {
    const list = byConversation.get(m.conversationId);
    if (list) list.push(m);
    else byConversation.set(m.conversationId, [m]);
  }

  const inPeriod = (d: Date) => d.getTime() >= pStart.getTime() && d.getTime() < pEnd.getTime();
  const waits: ResponseWait[] = [];
  let unanswered = 0;

  for (const list of byConversation.values()) {
    list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    let waitingSince: Date | null = null;
    for (const m of list) {
      if (m.direction === "in") {
        if (!waitingSince) waitingSince = m.createdAt;
      } else if (waitingSince) {
        if (inPeriod(waitingSince)) {
          waits.push({ minutes: (m.createdAt.getTime() - waitingSince.getTime()) / MINUTE_MS, byBot: m.sentByBot });
        }
        waitingSince = null;
      }
    }
    if (waitingSince && inPeriod(waitingSince)) unanswered += 1;
  }

  return { waits, unanswered };
}

export function summarizeResponseTimes(waits: ResponseWait[], unanswered: number): ResponseTimeSummary {
  const all = waits.map((w) => w.minutes);
  const human = waits.filter((w) => !w.byBot).map((w) => w.minutes);
  return {
    waits: waits.length,
    medianMinutes: median(all),
    averageMinutes: average(all),
    humanWaits: human.length,
    humanMedianMinutes: median(human),
    unanswered,
  };
}

/** "45 min", "2 h 10 min", "1,5 d": duración legible a partir de minutos. */
export function formatDuration(minutes: number | null): string {
  if (minutes == null) return "—";
  if (minutes < 1) return "menos de 1 min";
  const total = Math.round(minutes);
  if (total < 60) return `${total} min`;
  if (total < 60 * 24) {
    const h = Math.floor(total / 60);
    const m = total % 60;
    return m === 0 ? `${h} h` : `${h} h ${m} min`;
  }
  return `${(minutes / (60 * 24)).toFixed(1).replace(".", ",")} d`;
}
