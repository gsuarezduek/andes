import "server-only";

import { prisma } from "@/lib/prisma";
import { formatDateInput, mendozaWallTimeToUtc } from "@/lib/datetime";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Ventana por defecto (columnas de día) que muestra el calendario. */
export const DEFAULT_CALENDAR_DAYS = 30;

/** Presets de rango que ofrece el filtro Semana/Mes. */
export const WEEK_DAYS = 7;
export const MONTH_DAYS = 30;

/** Valida el parámetro `days` de la URL; cualquier otra cosa cae al default. */
export function normalizeCalendarDays(raw: string | undefined): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 90) return DEFAULT_CALENDAR_DAYS;
  return n;
}

/** Un tramo alquilado de un auto dentro de la ventana visible. */
export type CalendarBar = {
  rentalId: string;
  /** Índice de la primera columna (día) ocupada, ya recortado a la ventana. */
  startIndex: number;
  /** Cantidad de columnas que abarca la barra. */
  span: number;
  clientName: string;
  status: string;
  /** Reserva confirmada en VikRentCar. `false` = standby → barra naranja. */
  confirmed: boolean;
  /** Nota de la reserva (custdata de VikRentCar), para el tooltip. */
  note: string | null;
  /** Nombres de conductores adicionales, para el tooltip. */
  extraDrivers: string[];
  /** Instantes reales del alquiler (para mostrar fecha/hora en el tooltip). */
  startAt: Date;
  endAt: Date;
  /** Modelo pactado cuando la reserva no tiene unidad asignada. */
  bookingModel: string | null;
};

export type CalendarRow = {
  id: string;
  plate: string | null;
  label: string;
  /** Auto en service / fuera de servicio → fila resaltada en rosa claro. */
  outOfService: boolean;
  bars: CalendarBar[];
};

export type CalendarColumn = {
  /** "YYYY-MM-DD" en hora de Mendoza. */
  key: string;
  day: number;
  /** Etiqueta corta de día de semana ("lun", "mar", …). */
  weekday: string;
  /** Etiqueta de mes ("ene", "feb", …), sólo en la primera columna de cada mes. */
  monthLabel: string | null;
  isToday: boolean;
  isWeekend: boolean;
};

export type CalendarData = {
  columns: CalendarColumn[];
  rows: CalendarRow[];
  /** Reservas sin unidad asignada (una fila por reserva; incluye sin confirmar). */
  unassigned: CalendarRow[];
  from: string;
  prevFrom: string;
  nextFrom: string;
  todayFrom: string;
  days: number;
};

const WEEKDAY_FMT = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Mendoza",
  weekday: "short",
});
const MONTH_FMT = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Mendoza",
  month: "short",
});

/** Normaliza un "YYYY-MM-DD" válido; si no lo es, devuelve el día de hoy (Mendoza). */
function normalizeFrom(raw: string | undefined): string {
  const today = formatDateInput(new Date());
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return today;
  // Que sea una fecha real (rechaza 2026-13-40, etc.).
  const asUtc = mendozaWallTimeToUtc(`${raw}T00:00`);
  if (Number.isNaN(asUtc.getTime())) return today;
  return raw;
}

/** Suma `n` días a un "YYYY-MM-DD" de Mendoza y devuelve otro "YYYY-MM-DD". */
function addDays(from: string, n: number): string {
  const start = mendozaWallTimeToUtc(`${from}T00:00`);
  return formatDateInput(new Date(start.getTime() + n * DAY_MS));
}

type RentalRow = {
  id: string;
  vehicleId: string | null;
  clientName: string;
  status: string;
  bookingConfirmed: boolean;
  startAt: Date;
  endAt: Date;
  bookingNote: string | null;
  bookingModel: string | null;
  additionalDrivers: unknown;
};

function extraDriverNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((d) =>
      d && typeof d === "object" && "name" in d
        ? String((d as { name?: unknown }).name ?? "").trim()
        : "",
    )
    .filter((n) => n.length > 0);
}

/** Construye la barra de un alquiler recortada a la ventana [windowStart, days). */
function toBar(
  r: RentalRow,
  windowStart: Date,
  days: number,
): CalendarBar | null {
  const relStart = (r.startAt.getTime() - windowStart.getTime()) / DAY_MS;
  const relEnd = (r.endAt.getTime() - windowStart.getTime()) / DAY_MS;
  const startIndex = Math.max(0, Math.floor(relStart));
  const endIndex = Math.min(days - 1, Math.ceil(relEnd) - 1);
  if (endIndex < startIndex) return null;
  return {
    rentalId: r.id,
    startIndex,
    span: endIndex - startIndex + 1,
    clientName: r.clientName?.trim() || "Sin nombre",
    status: r.status,
    confirmed: r.bookingConfirmed,
    note: r.bookingNote?.trim() || null,
    extraDrivers: extraDriverNames(r.additionalDrivers),
    startAt: r.startAt,
    endAt: r.endAt,
    bookingModel: r.bookingModel,
  };
}

/**
 * Datos para la vista Calendario: filas = autos (orden manual, del más caro al
 * más económico), columnas = días, barras = alquileres. Ventana móvil desde
 * `from` (default hoy) por `days` columnas, navegable hacia adelante/atrás.
 */
export async function getCalendarData(opts?: {
  from?: string;
  days?: number;
}): Promise<CalendarData> {
  const days = opts?.days ?? DEFAULT_CALENDAR_DAYS;
  const from = normalizeFrom(opts?.from);
  const windowStart = mendozaWallTimeToUtc(`${from}T00:00`);
  const windowEnd = new Date(windowStart.getTime() + days * DAY_MS);
  const todayKey = formatDateInput(new Date());

  const [vehicles, rentals] = await Promise.all([
    prisma.vehicle.findMany({
      where: { archivedAt: null },
      // asc pone NULLS LAST en Postgres → los sin orden quedan al final.
      orderBy: [{ sortOrder: "asc" }, { brand: "asc" }, { model: "asc" }, { plate: "asc" }],
      select: { id: true, plate: true, brand: true, model: true, status: true },
    }),
    prisma.rental.findMany({
      // Se incluyen las canceladas (se pintan en rojo); el recorte de ventana
      // por fechas evita traer histórico irrelevante.
      where: {
        startAt: { lt: windowEnd },
        endAt: { gt: windowStart },
      },
      select: {
        id: true,
        vehicleId: true,
        clientName: true,
        status: true,
        bookingConfirmed: true,
        startAt: true,
        endAt: true,
        bookingNote: true,
        bookingModel: true,
        additionalDrivers: true,
      },
      orderBy: { startAt: "asc" },
    }),
  ]);

  // Columnas de día.
  const columns: CalendarColumn[] = [];
  let lastMonth = "";
  for (let i = 0; i < days; i++) {
    const dayDate = new Date(windowStart.getTime() + i * DAY_MS);
    const key = formatDateInput(dayDate);
    const weekday = WEEKDAY_FMT.format(dayDate).replace(".", "");
    const monthKey = key.slice(0, 7);
    const monthLabel = monthKey !== lastMonth ? MONTH_FMT.format(dayDate).replace(".", "") : null;
    lastMonth = monthKey;
    const dow = new Date(dayDate).getUTCDay(); // sólo para fin de semana aprox.
    columns.push({
      key,
      day: Number(key.slice(8, 10)),
      weekday,
      monthLabel,
      isToday: key === todayKey,
      isWeekend: weekday === "sáb" || weekday === "dom" || dow === 0 || dow === 6,
    });
  }

  // Barras por vehículo.
  const barsByVehicle = new Map<string, CalendarBar[]>();
  const unassigned: CalendarRow[] = [];
  for (const r of rentals as RentalRow[]) {
    const bar = toBar(r, windowStart, days);
    if (!bar) continue;
    if (r.vehicleId) {
      const list = barsByVehicle.get(r.vehicleId) ?? [];
      list.push(bar);
      barsByVehicle.set(r.vehicleId, list);
    } else {
      // Una fila por reserva sin unidad, para que no se pisen entre sí.
      unassigned.push({
        id: r.id,
        plate: null,
        label: bar.bookingModel ? `${bar.bookingModel} · sin unidad` : "Sin unidad asignada",
        outOfService: false,
        bars: [bar],
      });
    }
  }

  const rows: CalendarRow[] = vehicles.map((v) => ({
    id: v.id,
    plate: v.plate,
    label: `${v.brand} ${v.model}`,
    outOfService: v.status === "out_of_service",
    bars: barsByVehicle.get(v.id) ?? [],
  }));

  return {
    columns,
    rows,
    unassigned,
    from,
    prevFrom: addDays(from, -days),
    nextFrom: addDays(from, days),
    todayFrom: todayKey,
    days,
  };
}
