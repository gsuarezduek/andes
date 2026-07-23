import { SubmitButton } from "@/components/ui/submit-button";
import { formatDateTime } from "@/lib/datetime";
import { addRentalNote, resolveRentalNote } from "@/app/(app)/rentals/[id]/notes-actions";
import type { RentalDetail } from "@/lib/rental-detail-queries";

export function TeamNotesSection({
  rentalId,
  activeNotes,
  resolvedNotes,
}: {
  rentalId: string;
  activeNotes: RentalDetail["teamNotes"];
  resolvedNotes: RentalDetail["teamNotes"];
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-foreground/10 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">Notas del equipo</h2>
      {activeNotes.length > 0 && (
        <ul className="flex flex-col gap-2">
          {activeNotes.map((n) => (
            <li
              key={n.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/[0.06] px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="whitespace-pre-wrap">{n.text}</p>
                <p className="mt-1 text-xs text-foreground/50">
                  {n.createdBy?.name ?? "—"} · {formatDateTime(n.createdAt)}
                </p>
              </div>
              <form action={resolveRentalNote.bind(null, rentalId, n.id)} className="shrink-0">
                <button className="text-xs font-medium text-emerald-600">Resolver</button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <form action={addRentalNote.bind(null, rentalId)} className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <textarea
          name="text"
          required
          rows={2}
          placeholder="Ej: el cliente pidió cambiar el horario de entrega…"
          className="min-w-0 flex-1 rounded-lg border border-foreground/15 bg-transparent px-3 py-2 text-sm"
        />
        <SubmitButton pendingLabel="Agregando…">Agregar nota</SubmitButton>
      </form>
      {resolvedNotes.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer text-xs font-medium text-foreground/60">
            Historial de notas ({resolvedNotes.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-2">
            {resolvedNotes.map((n) => (
              <li key={n.id} className="rounded-lg border border-foreground/10 px-3 py-2 text-sm">
                <p className="whitespace-pre-wrap text-foreground/70">{n.text}</p>
                <p className="mt-1 text-xs text-foreground/50">
                  {n.createdBy?.name ?? "—"} · {formatDateTime(n.createdAt)}
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  Resuelto por {n.resolvedBy?.name ?? "—"} · {n.resolvedAt ? formatDateTime(n.resolvedAt) : ""}
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
