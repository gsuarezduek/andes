"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { maintenanceTypeLabels } from "@/lib/labels";
import { formatDate } from "@/lib/datetime";
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
