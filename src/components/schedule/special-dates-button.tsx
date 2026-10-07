"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { DateField, FormError, TextField } from "@/components/ui/fields";
import { CloseIcon } from "@/components/ui/icons";
import { addSpecialDates } from "@/app/(app)/horarios/special-dates-actions";

/**
 * "+ Agregar fecha especial" (admin): modal para cargar uno o varios feriados
 * o días especiales de una, con un motivo compartido. Cada fila es un día
 * (DD/MM/AAAA); "+ Agregar otro día" suma filas, la "×" las sacude.
 */
export function SpecialDatesButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        + Agregar fecha especial
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Agregar fecha especial" className="max-w-sm">
        {open ? <SpecialDatesForm onDone={() => setOpen(false)} /> : null}
      </Modal>
    </>
  );
}

function SpecialDatesForm({ onDone }: { onDone: () => void }) {
  const [dates, setDates] = useState<string[]>([""]);
  const [label, setLabel] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function setDateAt(i: number, value: string) {
    setDates((cur) => cur.map((d, idx) => (idx === i ? value : d)));
  }
  function removeAt(i: number) {
    setDates((cur) => cur.filter((_, idx) => idx !== i));
  }

  function save() {
    setError(null);
    const uniqueDates = [...new Set(dates.filter(Boolean))];
    if (uniqueDates.length === 0) {
      setError("Agregá al menos un día.");
      return;
    }
    if (!label.trim()) {
      setError("Hace falta un motivo (ej. «Feriado nacional»).");
      return;
    }
    startTransition(async () => {
      const res = await addSpecialDates({ dates: uniqueDates, label: label.trim() });
      if (res.ok) onDone();
      else setError(res.error);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {dates.map((d, i) => (
          <div key={i} className="flex items-end gap-2">
            <DateField
              id={`special-date-${i}`}
              label={i === 0 ? "Día" : `Día ${i + 1}`}
              value={d}
              onChange={(v) => setDateAt(i, v)}
            />
            {dates.length > 1 ? (
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label="Quitar este día"
                className="mb-2.5 flex size-8 shrink-0 items-center justify-center rounded-md text-foreground/40 hover:bg-foreground/5 hover:text-foreground/70"
              >
                <CloseIcon />
              </button>
            ) : null}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setDates((cur) => [...cur, ""])}
        className="self-start text-xs font-medium text-foreground/60 underline"
      >
        + Agregar otro día
      </button>

      <TextField
        id="special-label"
        label="Motivo"
        hint="Ej. «Feriado nacional», «Cierre por balance»"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        maxLength={120}
      />

      <FormError>{error}</FormError>

      <div className="flex items-center gap-3">
        <button type="button" onClick={onDone} className="text-xs text-foreground/50">
          Cancelar
        </button>
        <Button type="button" onClick={save} disabled={pending} className="ml-auto">
          {pending ? "Guardando…" : "Guardar"}
        </Button>
      </div>
    </div>
  );
}
