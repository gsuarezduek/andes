"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/fields";
import { EditIcon } from "@/components/ui/icons";
import { updateBookingNote } from "@/app/(app)/rentals/[id]/booking-note-actions";

/**
 * "Info de la reserva" (custdata de VikRentCar, o lo que cargue el equipo),
 * editable en cualquier reserva. Una vez editada, el sync deja de pisarla.
 */
export function BookingNoteSection({
  rentalId,
  note,
  fromVikRentCar,
  editedLabel,
}: {
  rentalId: string;
  note: string | null;
  fromVikRentCar: boolean;
  /** "Editado por X · fecha", o null si nunca se editó en Andes. */
  editedLabel: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const title = fromVikRentCar && !editedLabel ? "Info de la reserva (VikRentCar)" : "Info de la reserva";

  function startEditing() {
    setText(note ?? "");
    setError(null);
    setEditing(true);
  }

  function save() {
    startTransition(async () => {
      const result = await updateBookingNote(rentalId, text);
      if (result.error) {
        setError(result.error);
        return;
      }
      setEditing(false);
    });
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4">
        <label htmlFor="bookingNote" className="text-xs font-medium text-foreground/70">
          {title}
        </label>
        <textarea
          id="bookingNote"
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
          className="min-h-[7rem] w-full rounded-lg border border-foreground/15 bg-background p-3 text-base outline-none focus:border-foreground/40"
        />
        {fromVikRentCar && !editedLabel && (
          <p className="text-xs text-foreground/50">
            Al guardar, la sincronización con VikRentCar deja de actualizar este texto para esta reserva.
          </p>
        )}
        <FormError>{error ?? undefined}</FormError>
        <div className="flex gap-2">
          <Button type="button" onClick={save} disabled={pending} className="flex-1">
            {pending ? "Guardando…" : "Guardar"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => setEditing(false)} disabled={pending}>
            Cancelar
          </Button>
        </div>
      </div>
    );
  }

  if (!note) {
    return (
      <button
        type="button"
        onClick={startEditing}
        className="rounded-xl border border-dashed border-foreground/20 px-4 py-3 text-left text-sm text-foreground/60 hover:bg-foreground/[0.03]"
      >
        + Agregar info de la reserva
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-foreground/10 bg-foreground/[0.03] p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-foreground/70">{title}</p>
        <button
          type="button"
          onClick={startEditing}
          aria-label="Editar info de la reserva"
          className="-m-2 p-2 text-foreground/50 hover:text-foreground"
        >
          <EditIcon />
        </button>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm text-foreground/80">{note}</p>
      {editedLabel && <p className="mt-2 text-xs text-foreground/40">{editedLabel}</p>}
    </div>
  );
}
