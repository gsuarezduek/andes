/**
 * Airbnb y Booking suelen sincronizarse entre sí: la estadía de un canal
 * aparece en el feed del otro como un bloqueo ("Not available"). Sin
 * corregirlo, la misma estadía se vería dos veces en el Calendario y parecería
 * una doble reserva. Regla: si dos reservas activas de distinta procedencia
 * de la misma habitación tienen EXACTAMENTE las mismas fechas, se muestra una
 * sola (la "real") y la otra queda oculta como espejo.
 */

export type MirrorCandidate = {
  id: string;
  roomId: string;
  source: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  isBlock: boolean;
  status: "confirmed" | "cancelled";
  externalLabel: string | null;
  createdAt: Date;
};

/** Cuánto "parece real" una reserva: más alto = más probable que sea la original. */
function realness(b: MirrorCandidate): number {
  if (b.source === "manual") return 3;
  if (b.isBlock) return 0;
  if (/not available|closed/i.test(b.externalLabel ?? "")) return 1;
  return 2;
}

/** Devuelve los ids de las reservas que son espejo de otra (para ocultarlas). */
export function findMirroredIds(bookings: MirrorCandidate[]): Set<string> {
  const groups = new Map<string, MirrorCandidate[]>();
  for (const b of bookings) {
    if (b.status !== "confirmed") continue;
    const key = `${b.roomId}|${b.startDate}|${b.endDate}`;
    const list = groups.get(key) ?? [];
    list.push(b);
    groups.set(key, list);
  }
  const hidden = new Set<string>();
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    // Solo cuenta como espejo si vienen de procedencias distintas.
    if (new Set(list.map((b) => b.source)).size < 2) continue;
    const sorted = [...list].sort(
      (a, b) => realness(b) - realness(a) || a.createdAt.getTime() - b.createdAt.getTime(),
    );
    for (const b of sorted.slice(1)) hidden.add(b.id);
  }
  return hidden;
}
