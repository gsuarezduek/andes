"use client";

import { useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { assignGpsDevice, deleteGpsDevice, updateGpsDeviceNotes } from "./actions";

type VehicleOption = { id: string; label: string };

export function GpsDeviceRow({
  device,
  vehicles,
  isAdmin,
}: {
  device: { id: string; identifier: string; vehicleId: string | null; notes: string | null };
  vehicles: VehicleOption[];
  isAdmin: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState(device.notes ?? "");
  const [pending, startTransition] = useTransition();

  function handleSaveNotes() {
    setError(null);
    startTransition(async () => {
      try {
        await updateGpsDeviceNotes(device.id, notesDraft);
        setEditingNotes(false);
      } catch (err) {
        unstable_rethrow(err);
        setError(err instanceof Error ? err.message : "No se pudo guardar la nota.");
      }
    });
  }

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
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{device.identifier}</span>
        <select
          value={device.vehicleId ?? ""}
          onChange={(e) => handleAssign(e.target.value)}
          disabled={pending}
          className="min-w-0 max-w-[55%] truncate rounded-md border border-foreground/15 bg-transparent px-2 py-1.5 text-sm disabled:opacity-60"
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

      {editingNotes ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            rows={2}
            placeholder="Ej. debajo del asiento del acompañante"
            className="min-h-[3.5rem] w-full rounded-lg border border-foreground/15 bg-transparent p-2 text-sm outline-none focus:border-foreground/40"
            disabled={pending}
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSaveNotes}
              disabled={pending}
              className="rounded-md bg-foreground/90 px-2.5 py-1 text-xs font-medium text-background disabled:opacity-60"
            >
              {pending ? "Guardando…" : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setNotesDraft(device.notes ?? "");
                setEditingNotes(false);
              }}
              disabled={pending}
              className="text-xs text-foreground/50"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditingNotes(true)}
          className="flex items-start gap-1 text-left text-xs text-foreground/50 hover:text-foreground/80"
        >
          {device.notes ? (
            <span className="truncate">📍 {device.notes}</span>
          ) : (
            <span className="italic">Agregar dónde está instalado…</span>
          )}
        </button>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </li>
  );
}
