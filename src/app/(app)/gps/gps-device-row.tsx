"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { assignGpsDevice, deleteGpsDevice } from "./actions";

type VehicleOption = { id: string; label: string };

export function GpsDeviceRow({
  device,
  vehicles,
  isAdmin,
}: {
  device: { id: string; identifier: string; vehicleId: string | null };
  vehicles: VehicleOption[];
  isAdmin: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleAssign(vehicleId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await assignGpsDevice(device.id, vehicleId || null);
      } catch (err) {
        unstable_rethrow(err);
        setError(err instanceof Error ? err.message : "No se pudo asignar.");
      }
    });
  }

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      try {
        await deleteGpsDevice(device.id);
      } catch (err) {
        unstable_rethrow(err);
        setConfirmDelete(false);
        setError(err instanceof Error ? err.message : "No se pudo borrar.");
      }
    });
  }

  if (confirmDelete && isAdmin) {
    return (
      <li className="flex items-center justify-between gap-3 bg-red-500/5 px-3 py-2">
        <span className="text-sm text-red-700 dark:text-red-400">
          ¿Borrar el GPS &quot;{device.identifier}&quot;? No se puede deshacer.
        </span>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            className="text-xs text-foreground/50"
            disabled={pending}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60"
          >
            {pending ? "Borrando…" : "Sí, borrar"}
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-1 px-3 py-2">
      <div className="flex items-center gap-3">
        <span className="flex-1 truncate text-sm font-medium">{device.identifier}</span>
        <select
          value={device.vehicleId ?? ""}
          onChange={(e) => handleAssign(e.target.value)}
          disabled={pending}
          className="rounded-md border border-foreground/15 bg-transparent px-2 py-1.5 text-sm disabled:opacity-60"
        >
          <option value="">Sin instalar</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-500/10"
          >
            Borrar
          </button>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </li>
  );
}
