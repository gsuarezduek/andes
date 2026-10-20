"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { maintenanceTypeLabels } from "@/lib/labels";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { deleteMaintenance } from "@/app/(app)/vehicles/[id]/maintenance-actions";
import type { MaintenanceType } from "@prisma/client";

// Recibe campos escalares (no el registro de Prisma tal cual) porque `cost`
// es un Decimal: un Server Component no puede pasarle una instancia de
// Decimal a un Client Component, solo tipos planos serializables.
type MaintenanceRowLog = {
  id: string;
  type: MaintenanceType;
  date: Date;
  km: number | null;
  costLabel: string | null;
  place: string | null;
  description: string;
  /** Reserva del service/arreglo (null si se cargó directo desde la ficha). */
  rental: {
    id: string;
    bookingNote: string | null;
    notes: {
      id: string;
      text: string;
      createdByName: string;
      createdAt: Date;
      resolvedAt: Date | null;
      resolvedByName: string | null;
    }[];
  } | null;
};

export function MaintenanceRow({
  vehicleId,
  log,
  isAdmin,
}: {
  vehicleId: string;
  log: MaintenanceRowLog;
  isAdmin: boolean;
}) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="flex items-center justify-between gap-3 bg-red-500/5 px-4 py-3 text-sm">
        <span className="text-red-700 dark:text-red-400">
          ¿Borrar este registro de &quot;{log.description}&quot;? No se puede deshacer.
        </span>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="text-xs text-foreground/50"
          >
            Cancelar
          </button>
          <form action={deleteMaintenance.bind(null, vehicleId, log.id)}>
            <SubmitButton variant="danger" pendingLabel="Borrando…" className="h-auto px-2.5 py-1 text-xs">
              Sí, borrar
            </SubmitButton>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Badge tone="neutral">{maintenanceTypeLabels[log.type]}</Badge>
          <span className="text-xs text-foreground/50">
            {formatDate(log.date)}
            {log.km != null ? ` · ${log.km.toLocaleString("es-AR")} km` : ""}
          </span>
        </div>
        <p className="mt-1">{log.description}</p>
        {log.place && <p className="text-xs text-foreground/50">📍 {log.place}</p>}
        {log.rental && <MaintenanceRentalNotes rental={log.rental} />}
      </div>
      <div className="flex flex-col items-end gap-1">
        {log.costLabel && <span className="font-medium">{log.costLabel}</span>}
        {isAdmin && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="text-xs text-red-600"
          >
            Borrar
          </button>
        )}
      </div>
    </div>
  );
}

// Todas las notas de la reserva del service (activas y resueltas) + la "Info
// de la reserva", para ver el contexto del arreglo sin entrar a la reserva.
function MaintenanceRentalNotes({ rental }: { rental: NonNullable<MaintenanceRowLog["rental"]> }) {
  const hasContent = rental.bookingNote || rental.notes.length > 0;
  return (
    <div className="mt-2 flex flex-col gap-1.5">
      {rental.bookingNote && (
        <div className="rounded-lg bg-foreground/[0.04] px-3 py-2">
          <p className="text-xs font-medium text-foreground/60">Info de la reserva</p>
          <p className="whitespace-pre-wrap text-xs text-foreground/80">{rental.bookingNote}</p>
        </div>
      )}
      {rental.notes.map((n) => (
        <div
          key={n.id}
          className={`rounded-lg px-3 py-2 ${n.resolvedAt ? "bg-foreground/[0.04]" : "border border-red-500/30 bg-red-500/5"}`}
        >
          <p className="whitespace-pre-wrap text-xs text-foreground/80">{n.text}</p>
          <p className="mt-0.5 text-[11px] text-foreground/50">
            {n.createdByName} · {formatDateTime(n.createdAt)}
            {n.resolvedAt
              ? ` · Resuelta por ${n.resolvedByName ?? "—"} · ${formatDateTime(n.resolvedAt)}`
              : " · Sin resolver"}
          </p>
        </div>
      ))}
      <Link href={`/rentals/${rental.id}`} className="text-xs text-foreground/60 underline">
        {hasContent ? "Ver reserva del service" : "Ver reserva del service (sin notas)"}
      </Link>
    </div>
  );
}
