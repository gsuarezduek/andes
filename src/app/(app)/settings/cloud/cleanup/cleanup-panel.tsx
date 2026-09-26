"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/fields";
import { Badge } from "@/components/ui/badge";
import { formatBytes } from "@/lib/format-bytes";
import { CATEGORY_LABELS, MIN_AGE_DAYS, type CleanupCategory } from "@/lib/storage-cleanup-rules";
import type { RunProgress } from "@/lib/storage-cleanup-run";
import {
  previewCleanup,
  startCleanup,
  runCleanupBatch,
  type ActionPreview,
  type CleanupFilters,
} from "./actions";

export type RunHistoryRow = {
  id: string;
  action: "delete" | "compress";
  createdAt: string;
  createdByName: string;
  fileCount: number;
  doneCount: number;
  changedCount: number;
  bytesFreed: number;
  completed: boolean;
  categories: string[];
};

const GROUPS: { title: string; hint?: string; categories: CleanupCategory[] }[] = [
  {
    title: "Evidencia de alquileres",
    hint: `Para eliminar solo cuentan alquileres finalizados, con acta guardada y de más de ${MIN_AGE_DAYS.deleteEvidence} días.`,
    categories: ["photos", "damage_photos", "videos", "documents"],
  },
  {
    title: "WhatsApp",
    hint: "Se borra el archivo; el mensaje queda en la conversación como “adjunto eliminado”.",
    categories: ["wa_image", "wa_video", "wa_audio", "wa_document"],
  },
  {
    title: "Firmas y actas",
    hint: "Son la evidencia firmada: se pueden descargar y comprimir, nunca eliminar.",
    categories: ["signatures", "actas"],
  },
];

const DEFAULT_SELECTED: CleanupCategory[] = ["photos", "videos", "documents"];

function exportHref(mode: "export" | "delete", f: CleanupFilters, part: number): string {
  const q = new URLSearchParams({ mode, from: f.from, to: f.to, categories: f.categories.join(","), part: String(part) });
  return `/api/storage/export?${q.toString()}`;
}

function CategoryTable({ preview }: { preview: ActionPreview }) {
  if (preview.count === 0) return null;
  return (
    <ul className="flex flex-col divide-y divide-foreground/10 text-sm">
      {preview.byCategory.map((c) => (
        <li key={c.category} className="flex items-center justify-between gap-3 py-1.5">
          <span>{c.label}</span>
          <span className="text-foreground/60">
            {c.count.toLocaleString("es-AR")} · {formatBytes(c.bytes)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Notes({ notes }: { notes: string[] }) {
  if (notes.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-amber-700 dark:text-amber-400">
      {notes.map((n) => (
        <li key={n}>{n}</li>
      ))}
    </ul>
  );
}

export function CleanupPanel({ history }: { history: RunHistoryRow[] }) {
  const router = useRouter();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<Set<CleanupCategory>>(new Set(DEFAULT_SELECTED));
  const [preview, setPreview] = useState<{ export: ActionPreview; delete: ActionPreview; compress: ActionPreview } | null>(null);
  const [filtersUsed, setFiltersUsed] = useState<CleanupFilters | null>(null);
  const [error, setError] = useState<string>();
  const [searching, startSearch] = useTransition();
  const [confirmText, setConfirmText] = useState("");

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<RunProgress | null>(null);
  const [runError, setRunError] = useState<string>();
  const stopRef = useRef(false);

  function toggle(c: CleanupCategory) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
    setPreview(null); // los números ya no corresponden a lo elegido
  }

  function search() {
    setError(undefined);
    const filters: CleanupFilters = { from, to, categories: [...selected] };
    if (!from || !to) return setError("Elegí las fechas desde y hasta.");
    if (selected.size === 0) return setError("Elegí al menos una categoría.");
    startSearch(async () => {
      const res = await previewCleanup(filters);
      if ("error" in res) {
        setError(res.error);
        setPreview(null);
        return;
      }
      setPreview(res);
      setFiltersUsed(filters);
    });
  }

  async function drive(runId: string) {
    stopRef.current = false;
    setRunning(true);
    setRunError(undefined);
    while (!stopRef.current) {
      const res = await runCleanupBatch(runId);
      if ("error" in res) {
        setRunError(res.error);
        break;
      }
      setProgress(res);
      if (res.completed) break;
    }
    setRunning(false);
    setConfirmText("");
    router.refresh();
    if (filtersUsed && !stopRef.current) {
      const fresh = await previewCleanup(filtersUsed);
      if (!("error" in fresh)) setPreview(fresh);
    }
  }

  async function begin(action: "delete" | "compress") {
    if (!filtersUsed) return;
    setRunError(undefined);
    setProgress(null);
    const res = await startCleanup(action, filtersUsed, confirmText);
    if ("error" in res) return setRunError(res.error);
    await drive(res.runId);
  }

  const del = preview?.delete;
  const allDownloaded = del ? del.parts > 0 && del.downloadedParts.length >= del.parts : false;

  return (
    <div className="flex flex-col gap-8">
      {/* 1. Filtros */}
      <section className="flex flex-col gap-4 rounded-xl border border-foreground/10 p-4">
        <h2 className="text-lg font-semibold">1. ¿Qué archivos?</h2>
        <div className="grid grid-cols-2 gap-3">
          <TextField id="cleanupFrom" label="Desde" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPreview(null); }} />
          <TextField id="cleanupTo" label="Hasta" type="date" value={to} onChange={(e) => { setTo(e.target.value); setPreview(null); }} />
        </div>
        {GROUPS.map((g) => (
          <fieldset key={g.title} className="flex flex-col gap-1.5">
            <legend className="text-sm font-medium">{g.title}</legend>
            {g.hint ? <p className="text-xs text-foreground/50">{g.hint}</p> : null}
            {g.categories.map((c) => (
              <label key={c} className="flex items-center gap-2 py-1 text-sm">
                <input type="checkbox" className="size-4" checked={selected.has(c)} onChange={() => toggle(c)} />
                {CATEGORY_LABELS[c]}
              </label>
            ))}
          </fieldset>
        ))}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Button type="button" onClick={search} disabled={searching || running}>
          {searching ? "Buscando…" : "Buscar archivos"}
        </Button>
      </section>

      {preview && filtersUsed ? (
        <>
          {/* 2. Descargar */}
          <section className="flex flex-col gap-3 rounded-xl border border-foreground/10 p-4">
            <h2 className="text-lg font-semibold">Descargar</h2>
            {preview.export.count === 0 ? (
              <p className="text-sm text-foreground/60">No hay archivos en ese rango.</p>
            ) : (
              <>
                <p className="text-sm">
                  <b>{preview.export.count.toLocaleString("es-AR")}</b> archivos · {formatBytes(preview.export.totalBytes)}. Se
                  bajan en {preview.export.parts} {preview.export.parts === 1 ? "ZIP" : "ZIPs"} (de hasta 250 MB), con una carpeta por reserva o conversación.
                </p>
                <CategoryTable preview={preview.export} />
                <div className="flex flex-wrap gap-2">
                  {Array.from({ length: preview.export.parts }, (_, i) => i + 1).map((n) => (
                    <a key={n} href={exportHref("export", filtersUsed, n)} download className="inline-flex h-11 items-center rounded-lg border border-foreground/15 px-4 text-sm font-semibold hover:bg-foreground/5">
                      Parte {n} de {preview.export.parts}
                    </a>
                  ))}
                </div>
              </>
            )}
          </section>

          {/* 3. Comprimir */}
          <section className="flex flex-col gap-3 rounded-xl border border-foreground/10 p-4">
            <h2 className="text-lg font-semibold">Comprimir</h2>
            <p className="text-sm text-foreground/60">
              Fotos: se reducen a 1600 px. Firmas: sin pérdida visible. Actas: se recomprimen las fotos internas, sin regenerar el documento.
              Solo se reemplaza un archivo si baja al menos un 15%. Lo más nuevo (menos de {MIN_AGE_DAYS.compressEvidence} días) no se toca.
            </p>
            <Notes notes={preview.compress.notes} />
            {preview.compress.count === 0 ? (
              <p className="text-sm text-foreground/60">No hay archivos para comprimir con esos filtros.</p>
            ) : (
              <>
                <p className="text-sm">
                  <b>{preview.compress.count.toLocaleString("es-AR")}</b> archivos · {formatBytes(preview.compress.totalBytes)} hoy
                </p>
                <CategoryTable preview={preview.compress} />
                <Button type="button" variant="secondary" onClick={() => begin("compress")} disabled={running}>
                  Comprimir estos archivos
                </Button>
              </>
            )}
          </section>

          {/* 4. Eliminar */}
          <section className="flex flex-col gap-3 rounded-xl border border-red-500/30 p-4">
            <h2 className="text-lg font-semibold">Eliminar</h2>
            <Notes notes={preview.delete.notes} />
            {preview.delete.count === 0 ? (
              <p className="text-sm text-foreground/60">No hay archivos que se puedan eliminar con esos filtros.</p>
            ) : (
              <>
                <p className="text-sm">
                  <b>{preview.delete.count.toLocaleString("es-AR")}</b> archivos · {formatBytes(preview.delete.totalBytes)} para liberar.
                </p>
                <CategoryTable preview={preview.delete} />
                <div className="rounded-lg border border-foreground/10 p-3">
                  <p className="mb-2 text-sm font-medium">Paso 1: descargá el respaldo completo de estos archivos</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {Array.from({ length: preview.delete.parts }, (_, i) => i + 1).map((n) => {
                      const done = preview.delete.downloadedParts.includes(n);
                      return (
                        <a key={n} href={exportHref("delete", filtersUsed, n)} download className="inline-flex h-11 items-center gap-2 rounded-lg border border-foreground/15 px-4 text-sm font-semibold hover:bg-foreground/5">
                          Parte {n} de {preview.delete.parts}
                          {done ? <Badge tone="emerald">Descargada</Badge> : null}
                        </a>
                      );
                    })}
                  </div>
                  <Button type="button" variant="secondary" className="mt-2" onClick={search} disabled={searching}>
                    Ya descargué — verificar
                  </Button>
                </div>
                <div className="rounded-lg border border-foreground/10 p-3">
                  <p className="mb-2 text-sm font-medium">Paso 2: confirmar</p>
                  <TextField
                    id="confirmDelete"
                    label="Escribí ELIMINAR para confirmar"
                    hint={allDownloaded ? "Esto no se puede deshacer." : "Se habilita cuando el respaldo esté completo."}
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    disabled={!allDownloaded}
                    autoComplete="off"
                  />
                  <Button
                    type="button"
                    variant="danger"
                    className="mt-2 w-full"
                    onClick={() => begin("delete")}
                    disabled={!allDownloaded || running || confirmText.trim().toUpperCase() !== "ELIMINAR"}
                  >
                    Eliminar {preview.delete.count.toLocaleString("es-AR")} archivos
                  </Button>
                </div>
              </>
            )}
          </section>
        </>
      ) : null}

      {/* Progreso de la corrida en curso */}
      {progress || runError ? (
        <section className="flex flex-col gap-2 rounded-xl border border-foreground/10 p-4" aria-live="polite">
          <h2 className="text-lg font-semibold">{progress?.action === "delete" ? "Eliminando…" : "Comprimiendo…"}</h2>
          {progress ? (
            <>
              <div className="h-2 w-full overflow-hidden rounded-full bg-foreground/10" role="progressbar" aria-valuenow={progress.doneCount} aria-valuemin={0} aria-valuemax={progress.fileCount}>
                <div className="h-full bg-emerald-500" style={{ width: `${(progress.doneCount / Math.max(1, progress.fileCount)) * 100}%` }} />
              </div>
              <p className="text-sm">
                {progress.doneCount.toLocaleString("es-AR")} de {progress.fileCount.toLocaleString("es-AR")} · liberados {formatBytes(progress.bytesFreed)}
                {progress.action === "compress" ? ` · ${progress.changedCount.toLocaleString("es-AR")} comprimidos` : ""}
                {progress.failed > 0 ? ` · ${progress.failed} con error en la última tanda` : ""}
              </p>
              {progress.completed ? <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Listo.</p> : null}
            </>
          ) : null}
          {runError ? <p className="text-sm text-red-600">{runError}</p> : null}
          {running ? (
            <Button type="button" variant="secondary" onClick={() => { stopRef.current = true; }}>
              Pausar (se puede continuar después)
            </Button>
          ) : null}
        </section>
      ) : null}

      {/* Historial */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Historial</h2>
        {history.length === 0 ? (
          <p className="text-sm text-foreground/60">Todavía no se hizo ninguna limpieza.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-foreground/10 rounded-xl border border-foreground/10 text-sm">
            {history.map((h) => (
              <li key={h.id} className="flex flex-col gap-1 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{h.action === "delete" ? "Eliminación" : "Compresión"}</span>
                  <Badge tone={h.completed ? "emerald" : "amber"}>{h.completed ? "Completa" : `${h.doneCount}/${h.fileCount}`}</Badge>
                </div>
                <p className="text-foreground/60">
                  {h.createdAt} · {h.createdByName} · {h.changedCount.toLocaleString("es-AR")} archivos · liberó {formatBytes(h.bytesFreed)}
                </p>
                <p className="text-xs text-foreground/50">{h.categories.map((c) => CATEGORY_LABELS[c as CleanupCategory] ?? c).join(" · ")}</p>
                {!h.completed && !running ? (
                  <Button type="button" variant="secondary" className="mt-1" onClick={() => drive(h.id)}>
                    Continuar
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
