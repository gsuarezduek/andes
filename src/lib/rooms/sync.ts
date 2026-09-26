import "server-only";
import { prisma } from "@/lib/prisma";
import { formatDateInput } from "@/lib/datetime";
import { parseIcal, isBlockEvent } from "./ical";
import { keyToDate, dateToKey } from "./dates";

const FETCH_TIMEOUT_MS = 15_000;
const MAX_BYTES = 2 * 1024 * 1024;

export type FeedSyncResult = {
  ok: boolean;
  imported: number;
  updated: number;
  cancelled: number;
  message: string;
};

export type RoomSyncSummary = {
  feeds: number;
  imported: number;
  updated: number;
  cancelled: number;
  errors: number;
};

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function fetchIcal(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { Accept: "text/calendar, text/plain, */*", "User-Agent": "Andes-RoomSync/1.0" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`El calendario respondió HTTP ${res.status}.`);
  const text = await res.text();
  if (text.length > MAX_BYTES) throw new Error("El calendario es demasiado grande.");
  return text;
}

/**
 * Sincroniza UN feed iCal: crea/actualiza las reservas y cancela las que
 * desaparecieron del feed (solo las que todavía no terminaron — Airbnb y
 * Booking sacan del feed las estadías viejas y eso no es una cancelación).
 * Nunca pisa lo cargado por una persona (notas, total, cobros). Si el feed no
 * se pudo leer o no es un iCal válido, NO se cancela nada.
 */
export async function syncRoomFeed(feedId: string): Promise<FeedSyncResult> {
  const feed = await prisma.roomCalendarFeed.findUnique({ where: { id: feedId } });
  if (!feed) return { ok: false, imported: 0, updated: 0, cancelled: 0, message: "Feed inexistente." };

  const finish = async (r: FeedSyncResult): Promise<FeedSyncResult> => {
    await prisma.roomCalendarFeed.update({
      where: { id: feedId },
      data: { lastSyncAt: new Date(), lastSyncOk: r.ok, lastSyncMessage: r.message.slice(0, 500) },
    });
    return r;
  };

  let raw: string;
  try {
    raw = await fetchIcal(feed.url);
  } catch (e) {
    return finish({ ok: false, imported: 0, updated: 0, cancelled: 0, message: `No se pudo leer el calendario: ${errMsg(e)}` });
  }
  const parsed = parseIcal(raw);
  if (!parsed.ok) return finish({ ok: false, imported: 0, updated: 0, cancelled: 0, message: parsed.error });

  const source = feed.source === "manual" ? "other" : feed.source;
  const todayKey = formatDateInput(new Date());
  const existing = await prisma.roomBooking.findMany({ where: { feedId } });
  const byUid = new Map(existing.map((b) => [b.externalUid, b]));
  const seen = new Set<string>();
  let imported = 0;
  let updated = 0;
  let cancelled = 0;

  for (const ev of parsed.events) {
    seen.add(ev.uid);
    const status = ev.cancelled ? ("cancelled" as const) : ("confirmed" as const);
    const isBlock = isBlockEvent(source, ev.summary);
    const current = byUid.get(ev.uid);
    if (!current) {
      await prisma.roomBooking.create({
        data: {
          roomId: feed.roomId,
          source: feed.source,
          feedId,
          externalUid: ev.uid,
          startDate: keyToDate(ev.startDate),
          endDate: keyToDate(ev.endDate),
          externalLabel: ev.summary,
          externalDescription: ev.description,
          isBlock,
          status,
          cancelledAt: status === "cancelled" ? new Date() : null,
        },
      });
      imported++;
      continue;
    }
    const changed =
      dateToKey(current.startDate) !== ev.startDate ||
      dateToKey(current.endDate) !== ev.endDate ||
      current.externalLabel !== ev.summary ||
      current.externalDescription !== ev.description ||
      current.isBlock !== isBlock ||
      current.status !== status;
    if (!changed) continue;
    await prisma.roomBooking.update({
      where: { id: current.id },
      data: {
        startDate: keyToDate(ev.startDate),
        endDate: keyToDate(ev.endDate),
        externalLabel: ev.summary,
        externalDescription: ev.description,
        isBlock,
        status,
        cancelledAt: status === "cancelled" ? (current.cancelledAt ?? new Date()) : null,
      },
    });
    updated++;
  }

  // Las que ya no están en el feed y todavía no terminaron → canceladas.
  for (const b of existing) {
    if (b.status !== "confirmed" || !b.externalUid || seen.has(b.externalUid)) continue;
    if (dateToKey(b.endDate) < todayKey) continue;
    await prisma.roomBooking.update({ where: { id: b.id }, data: { status: "cancelled", cancelledAt: new Date() } });
    cancelled++;
  }

  return finish({
    ok: true,
    imported,
    updated,
    cancelled,
    message: `${parsed.events.length} eventos · nuevas ${imported} · actualizadas ${updated} · canceladas ${cancelled}`,
  });
}

/** Sincroniza todos los feeds activos de habitaciones no archivadas. */
export async function runRoomSync(): Promise<RoomSyncSummary> {
  const feeds = await prisma.roomCalendarFeed.findMany({
    where: { active: true, room: { archivedAt: null } },
    select: { id: true },
  });
  const summary: RoomSyncSummary = { feeds: feeds.length, imported: 0, updated: 0, cancelled: 0, errors: 0 };
  for (const f of feeds) {
    try {
      const r = await syncRoomFeed(f.id);
      summary.imported += r.imported;
      summary.updated += r.updated;
      summary.cancelled += r.cancelled;
      if (!r.ok) summary.errors++;
    } catch (e) {
      summary.errors++;
      console.error("[rooms] sync de feed falló", f.id, errMsg(e));
    }
  }
  return summary;
}
