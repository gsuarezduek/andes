"use client";

import { useMemo, useState } from "react";
import { normalizeSearch } from "@/lib/command-palette";
import { AccessCredentialRow } from "@/components/access/access-credential-row";
import type { AccessCredentialRow as AccessCredentialRowData } from "@/lib/access-credentials";

type Row = AccessCredentialRowData & { canReveal: boolean };

/**
 * Buscador por servicio o usuario sobre la lista ya cargada (client-side,
 * sin ida y vuelta al servidor — mismo criterio que `CashMovementSearch`),
 * sin tildes ni mayúsculas (`normalizeSearch`, ya usado por la paleta de
 * comandos).
 */
export function AccessCredentialList({ credentials }: { credentials: Row[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = normalizeSearch(query);
    if (!q) return credentials;
    return credentials.filter(
      (c) => normalizeSearch(c.service).includes(q) || (c.username && normalizeSearch(c.username).includes(q)),
    );
  }, [credentials, query]);

  return (
    <div className="flex flex-col gap-3">
      {credentials.length > 5 && (
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por servicio o usuario…"
          className="h-11 w-full rounded-lg border border-foreground/15 bg-transparent px-3 text-base outline-none focus:border-foreground/40"
        />
      )}

      {filtered.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {filtered.map((c) => (
            <AccessCredentialRow key={c.id} credential={c} canReveal={c.canReveal} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-foreground/50">Sin coincidencias.</p>
      )}
    </div>
  );
}
