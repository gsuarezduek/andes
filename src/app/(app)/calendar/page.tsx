import type { Metadata } from "next";
import { requireUser } from "@/lib/auth-helpers";
import { getCalendarData, WIDE_DAYS } from "@/lib/calendar";
import { listConversationPickerOptions } from "@/lib/rental-quotes";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { CalendarGrid } from "./calendar-grid";
import { CalendarLegend } from "./calendar-legend";
import { MonthPicker } from "./month-picker";

export const metadata: Metadata = { title: "Calendario — Andes" };

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; month?: string }>;
}) {
  const user = await requireUser();
  const { from, month } = await searchParams;
  // Una sola vista rodante (90 días, columnas angostas con horario de
  // retiro/devolución en cada barra — ver `calendar-row.tsx`): se sacaron
  // los presets de "22 días"/"Mes" a pedido del dueño, para no duplicar la
  // misma información en distintas densidades de columna.
  const [data, conversationOptions, conditions] = await Promise.all([
    getCalendarData({ from, days: WIDE_DAYS, month }),
    listConversationPickerOptions(),
    prisma.conditionSettings.findUnique({ where: { id: 1 }, select: { extraHourPercent: true } }),
  ]);

  const rangeStart = data.columns[0]?.key;
  const rangeEnd = data.columns[data.columns.length - 1]?.key;
  // Modo rodante (90 días): navega por `from`. Modo mes específico
  // (`data.month` seteado): navega mes a mes, ignora `from`.
  const nav = (targetFrom: string) => `/calendar?from=${targetFrom}`;
  const navMonth = (targetMonth: string) => `/calendar?month=${targetMonth}`;

  const navBtn =
    "inline-flex h-9 items-center justify-center rounded-lg border border-foreground/15 px-3 text-sm font-semibold transition-colors hover:bg-foreground/5";

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
          <MonthPicker value={data.month} />
        </div>
      </div>

      <CalendarLegend showRooms={data.roomRows.length > 0} showThirdParty={data.thirdPartyRows.length > 0} />

      <CalendarGrid
        columns={data.columns}
        rows={data.rows}
        thirdPartyRows={data.thirdPartyRows}
        roomRows={data.roomRows}
        unassigned={data.unassigned}
        conversationOptions={conversationOptions}
        extraHourPercent={conditions?.extraHourPercent ?? null}
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
