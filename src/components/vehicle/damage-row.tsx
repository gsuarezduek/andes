"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import { markDamageRepaired, deleteDamage } from "@/app/(app)/vehicles/[id]/damage-actions";
import type { VehicleDetail } from "@/lib/vehicle-detail-queries";

type Damage = VehicleDetail["damages"][number];

export function DamageRow({
  vehicleId,
  damage,
  isAdmin,
}: {
  vehicleId: string;
  damage: Damage;
  isAdmin: boolean;
}) {
  const [confirming, setConfirming] = useState<"delete" | "repair" | null>(null);

  if (confirming === "delete") {
    return (
      <li className="flex items-center justify-between gap-3 bg-red-500/5 px-3 py-2 text-sm">
        <span className="min-w-0 text-red-700 dark:text-red-400">
          ¿Borrar &quot;{damage.description || "daño sin descripción"}&quot;? No se puede deshacer.
        </span>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setConfirming(null)}
            className="text-xs text-foreground/50"
          >
            Cancelar
          </button>
          <form action={deleteDamage.bind(null, vehicleId, damage.id)}>
            <SubmitButton variant="danger" pendingLabel="Borrando…" className="h-auto px-2.5 py-1 text-xs">
              Sí, borrar
            </SubmitButton>
          </form>
        </div>
      </li>
    );
  }

  if (confirming === "repair") {
    return (
      <li className="flex items-center justify-between gap-3 bg-emerald-500/5 px-3 py-2 text-sm">
        <span className="min-w-0 text-emerald-700 dark:text-emerald-400">
          ¿Marcar &quot;{damage.description || "daño sin descripción"}&quot; como reparado? Pasa al
          historial.
        </span>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setConfirming(null)}
            className="text-xs text-foreground/50"
          >
            Cancelar
          </button>
          <form action={markDamageRepaired.bind(null, vehicleId, damage.id)}>
            <SubmitButton pendingLabel="Guardando…" className="h-auto px-2.5 py-1 text-xs">
              Sí, marcar reparado
            </SubmitButton>
          </form>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
      <div className="flex min-w-0 items-center gap-3">
        {damage.photoUrl && (
          <a
            href={`/api/media?key=${encodeURIComponent(damage.photoUrl)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/media?key=${encodeURIComponent(damage.photoUrl)}`}
              alt={damage.description || "Foto del daño"}
              className="h-12 w-12 rounded-lg border border-foreground/10 object-cover"
            />
          </a>
        )}
        <span className="min-w-0">{damage.description || "Daño sin descripción"}</span>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={() => setConfirming("repair")}
          className="text-xs font-medium text-emerald-600"
        >
          Marcar reparado
        </button>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setConfirming("delete")}
            className="text-xs text-red-600"
          >
            Borrar
          </button>
        )}
      </div>
    </li>
  );
}
