/**
 * Airbnb y Booking suelen sincronizarse entre sí: la estadía de un canal
 * aparece en el feed del otro como un bloqueo ("Not available") — a veces con
 * días de más (buffer de limpieza) o con el límite de fechas corrido un día
 * por cómo cada plataforma cuenta el día de salida. Sin corregirlo, la misma
 * estadía se vería dos (o más) veces en el Calendario como "bloqueos" sueltos.
 * Regla: se agrupan por **solapamiento de fechas** (no exigen coincidencia
 * exacta) las reservas activas de la misma habitación; dentro de un grupo que
 * mezcla más de una procedencia, si al menos una fila "parece" un artefacto de
 * disponibilidad (un bloqueo explícito, o un rótulo genérico tipo "Not
 * available"/"CLOSED" que la otra plataforma pone al reflejar una reserva
 * ajena), se asume que es la misma estadía: se muestra la más "real" y el
 * resto queda oculto. Si ninguna fila del grupo parece un artefacto —dos
 * reservas de canales distintos que simplemente se solapan— no se oculta
 * nada: podría ser un overbooking real entre canales, y eso hay que verlo.
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

/** ¿Esta fila es, por su rótulo, un reflejo de disponibilidad y no una reserva en sí? */
function looksLikeAvailabilityArtifact(b: MirrorCandidate): boolean {
  return b.isBlock || /not available|closed/i.test(b.externalLabel ?? "");
}

/**
 * Agrupa intervalos [startDate, endDate) que se solapan transitivamente,
 * dentro de la misma habitación (algoritmo clásico de "merge intervals",
 * O(n log n) — las fechas "YYYY-MM-DD" comparan igual que la fecha real).
 */
function overlappingClusters(bookings: MirrorCandidate[]): MirrorCandidate[][] {
  const sorted = [...bookings].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const clusters: MirrorCandidate[][] = [];
  let clusterEnd = "";
  for (const b of sorted) {
    if (clusters.length > 0 && b.startDate < clusterEnd) {
      clusters.at(-1)!.push(b);
      if (b.endDate > clusterEnd) clusterEnd = b.endDate;
    } else {
      clusters.push([b]);
      clusterEnd = b.endDate;
    }
  }
  return clusters;
}

/** Devuelve los ids de las reservas que son espejo de otra (para ocultarlas). */
export function findMirroredIds(bookings: MirrorCandidate[]): Set<string> {
  const byRoom = new Map<string, MirrorCandidate[]>();
  for (const b of bookings) {
    if (b.status !== "confirmed") continue;
    const list = byRoom.get(b.roomId) ?? [];
    list.push(b);
    byRoom.set(b.roomId, list);
  }

  const hidden = new Set<string>();
  for (const roomBookings of byRoom.values()) {
    for (const cluster of overlappingClusters(roomBookings)) {
      if (cluster.length < 2) continue;
      // Solo cuenta como espejo si vienen de procedencias distintas.
      if (new Set(cluster.map((b) => b.source)).size < 2) continue;
      // Sin ningún artefacto de disponibilidad en el grupo, podría ser un
      // overbooking real entre canales — no se oculta nada.
      if (!cluster.some(looksLikeAvailabilityArtifact)) continue;
      const sorted = [...cluster].sort(
        (a, b) => realness(b) - realness(a) || a.createdAt.getTime() - b.createdAt.getTime(),
      );
      for (const b of sorted.slice(1)) hidden.add(b.id);
    }
  }
  return hidden;
}
