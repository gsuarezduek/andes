import { SectionTitle } from "@/components/ui/section-title";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatDateTime } from "@/lib/datetime";

type Note = {
  id: string;
  text: string;
  createdAt: Date;
  createdBy: { name: string } | null;
  resolvedBy?: { name: string } | null;
  resolvedAt?: Date | null;
};

/**
 * Mensajería de equipo sobre un vehículo o una reserva (distinta del campo
 * libre `notes` de la ficha del vehículo). Mismo componente para los dos —
 * antes eran dos copias idénticas salvo qué action llamaban.
 */
export function TeamNotesSection({
  activeNotes,
  resolvedNotes,
  addNote,
  resolveNote,
  placeholder,
}: {
  activeNotes: Note[];
  resolvedNotes: Note[];
  addNote: (formData: FormData) => Promise<void>;
  resolveNote: (noteId: string) => (formData: FormData) => Promise<void>;
  placeholder: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-foreground/10 p-4">
      <SectionTitle>Notas del equipo</SectionTitle>
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
              <form action={resolveNote(n.id)} className="shrink-0">
                <button className="text-xs font-medium text-emerald-600">Resolver</button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <form action={addNote} className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <textarea
          name="text"
          required
          rows={2}
          placeholder={placeholder}
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
