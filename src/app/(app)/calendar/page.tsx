import type { Metadata } from "next";
import { headers } from "next/headers";
import { requireUser } from "@/lib/auth-helpers";
import { detectLoginDevice } from "@/lib/user-agent";
import { getCalendarData, normalizeCalendarDays, WEEK_DAYS, MONTH_DAYS, WIDE_DAYS } from "@/lib/calendar";
import { listConversationPickerOptions } from "@/lib/rental-quotes";
import Link from "next/link";
import { CalendarGrid } from "./calendar-grid";
import { CalendarLegend } from "./calendar-legend";
import { MonthPicker } from "./month-picker";

export const metadata: Metadata = { title: "Calendario — Andes" };

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; days?: string; month?: string }>;
}) {
  const user = await requireUser();
  const { from, days: rawDays, month } = await searchParams;
  // Sin `days` explícito (entrada desde el menú): en celular arranca en Mes
  // (31 días) en vez de 90 — con 90 columnas de 46px no se lee casi nada.
  // Cualquier link del propio calendario ya lleva `days`, así que esto solo
  // define la vista inicial.
  const isMobile = detectLoginDevice((await headers()).get("user-agent")) === "mobile";
  const days = rawDays == null && isMobile ? MONTH_DAYS : normalizeCalendarDays(rawDays);
  const [data, conversationOptions] = await Promise.all([
    getCalendarData({ from, days, month }),
    listConversationPickerOptions(),
  ]);

  const rangeStart = data.columns[0]?.key;
  const rangeEnd = data.columns[data.columns.length - 1]?.key;
  // Modo rodante (Semana/Mes): navega por `from`+`days`. Modo mes específico
  // (`data.month` seteado): navega mes a mes, ignora `from`/`days`.
  const nav = (targetFrom: string) => `/calendar?from=${targetFrom}&days=${data.days}`;
  const navMonth = (targetMonth: string) => `/calendar?month=${targetMonth}`;

  const modeHref = (d: number) => `/calendar?from=${data.from}&days=${d}`;
  const navBtn =
    "inline-flex h-9 items-center justify-center rounded-lg border border-foreground/15 px-3 text-sm font-semibold transition-colors hover:bg-foreground/5";
  const segBtn = (active: boolean) =>
    `inline-flex h-9 items-center justify-center px-3 text-sm font-semibold transition-colors ${
      active ? "bg-foreground text-background" : "hover:bg-foreground/5"
    }`;

  return (
    <div className="ml-[calc(50%-50vw)] flex w-screen flex-col gap-3 px-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendario</h1>
          <p className="text-sm text-foreground/50">
            {data.month ? monthLabel(data.month) : `${fmtRange(rangeStart, rangeEnd)} · ${data.days} días`}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Link href={data.month ? navMonth(data.prevMonth) : nav(data.prevFrom)} className={navBtn} aria-label="Anterior">
            <span aria-hidden>←</span>
            <span className="ml-1 hidden sm:inline">Anterior</span>
          </Link>
          <Link href={data.month ? navMonth(data.todayMonth) : nav(data.todayFrom)} className={navBtn}>
            Hoy
          </Link>
          <Link href={data.month ? navMonth(data.nextMonth) : nav(data.nextFrom)} className={navBtn} aria-label="Siguiente">
            <span className="mr-1 hidden sm:inline">Siguiente</span>
            <span aria-hidden>→</span>
          </Link>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="flex shrink-0 overflow-hidden rounded-lg border border-foreground/15">
            <Link href={modeHref(WEEK_DAYS)} className={segBtn(!data.month && data.days === WEEK_DAYS)}>
              <span className="sm:hidden">Sem</span>
              <span className="hidden sm:inline">Semana</span>
            </Link>
            <Link
              href={modeHref(MONTH_DAYS)}
              className={`border-x border-foreground/15 ${segBtn(!data.month && data.days === MONTH_DAYS)}`}
            >
              Mes
            </Link>
            <Link href={modeHref(WIDE_DAYS)} className={segBtn(!data.month && data.days === WIDE_DAYS)}>
              <span className="sm:hidden">90d</span>
              <span className="hidden sm:inline">90 días</span>
            </Link>
          </div>
          <MonthPicker value={data.month} />
        </div>
      </div>

      <CalendarLegend showRooms={data.roomRows.length > 0} />

      <CalendarGrid
        columns={data.columns}
        rows={data.rows}
        roomRows={data.roomRows}
        unassigned={data.unassigned}
        conversationOptions={conversationOptions}
        userId={user.id}
        isAdmin={user.role === "admin"}
      />
    </div>
  );
}

function fmtRange(start?: string, end?: string): string {
  if (!start || !end) return "";
  const f = (s: string) => {
    const [, m, d] = s.split("-");
    return `${d}/${m}`;
  };
  return `${f(start)} — ${f(end)}`;
}

const MONTH_LABEL_FMT = new Intl.DateTimeFormat("es-AR", {
  month: "long",
  year: "numeric",
  timeZone: "America/Argentina/Mendoza",
});

/** "2026-09" → "Septiembre de 2026". */
function monthLabel(ym: string): string {
  const [year, month] = ym.split("-").map(Number);
  const label = MONTH_LABEL_FMT.format(new Date(Date.UTC(year, month - 1, 15, 12)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}
