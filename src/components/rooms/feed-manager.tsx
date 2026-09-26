"use client";

import { useActionState, useState } from "react";
import { SelectField, TextField, FormError } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDeleteCard } from "@/components/ui/confirm-delete-card";
import { formatDateTime } from "@/lib/datetime";
import { roomSourceLabels } from "@/lib/rooms/feed-url";
import { addFeed, removeFeed, type FormState } from "@/app/(app)/rooms/actions";

export type FeedView = {
  id: string;
  source: "airbnb" | "booking" | "other" | "manual";
  url: string;
  active: boolean;
  lastSyncAt: Date | null;
  lastSyncOk: boolean | null;
  lastSyncMessage: string | null;
};

/** Oculta el token del link (viaja en la query) — es una clave de acceso al calendario. */
function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname.length > 24 ? `${u.pathname.slice(0, 24)}…` : u.pathname}${u.search ? "?…" : ""}`;
  } catch {
    return "…";
  }
}

export function FeedManager({ roomId, feeds, isAdmin }: { roomId: string; feeds: FeedView[]; isAdmin: boolean }) {
  const [state, formAction] = useActionState<FormState, FormData>(addFeed.bind(null, roomId), {});
  const [confirming, setConfirming] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      {feeds.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {feeds.map((f) =>
            confirming === f.id ? (
              <ConfirmDeleteCard
                key={f.id}
                message={`¿Quitar el calendario de ${roomSourceLabels[f.source]}? Se borran las reservas que importó (las que tienen cobros en Caja se conservan).`}
                action={removeFeed.bind(null, f.id)}
                onCancel={() => setConfirming(null)}
              />
            ) : (
              <li key={f.id} className="flex items-start gap-3 rounded-lg border border-foreground/10 px-3 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {roomSourceLabels[f.source]}
                    {f.lastSyncOk === true ? <Badge tone="emerald">OK</Badge> : null}
                    {f.lastSyncOk === false ? <Badge tone="red">Error</Badge> : null}
                    {f.lastSyncOk == null ? <Badge tone="neutral">Sin leer</Badge> : null}
                  </p>
                  <p className="truncate text-xs text-foreground/50">{maskUrl(f.url)}</p>
                  {f.lastSyncAt ? (
                    <p className="text-xs text-foreground/50">
                      {formatDateTime(f.lastSyncAt)} · {f.lastSyncMessage}
                    </p>
                  ) : null}
                </div>
                {isAdmin ? (
                  <button type="button" onClick={() => setConfirming(f.id)} className="text-xs text-foreground/50 hover:text-red-600">
                    Quitar
                  </button>
                ) : null}
              </li>
            ),
          )}
        </ul>
      ) : (
        <p className="text-sm text-foreground/50">Todavía no hay calendarios conectados.</p>
      )}

      {isAdmin ? (
        <form action={formAction} className="flex flex-col gap-3 rounded-xl border border-foreground/10 p-4">
          <h3 className="text-sm font-semibold">Conectar un calendario</h3>
          <SelectField id="source" label="Origen" defaultValue="airbnb">
            <option value="airbnb">Airbnb</option>
            <option value="booking">Booking</option>
            <option value="other">Otro (cualquier link iCal)</option>
          </SelectField>
          <TextField
            id="url"
            label="Link iCal"
            required
            placeholder="https://…"
            hint="Airbnb: Calendario → Disponibilidad → Sincronizar calendarios → Exportar. Booking: Extranet → Tarifas y disponibilidad → Sincronizar calendario."
          />
          <FormError>{state.error}</FormError>
          {state.ok ? <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">{state.ok}</p> : null}
          <SubmitButton pendingLabel="Conectando…" variant="secondary">
            Conectar y leer
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}
