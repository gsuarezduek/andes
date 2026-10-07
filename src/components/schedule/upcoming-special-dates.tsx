"use client";

import { useTransition } from "react";
import { CloseIcon } from "@/components/ui/icons";
import { deleteSpecialDate } from "@/app/(app)/horarios/special-dates-actions";
import { formatSpecialDateLabel } from "@/lib/special-dates";

export type UpcomingSpecialDateItem = { id: string; date: string; label: string };

/** Lista de feriados/días especiales de los próximos 30 días. Admin puede quitarlos. */
export function UpcomingSpecialDates({ items, isAdmin }: { items: UpcomingSpecialDateItem[]; isAdmin: boolean }) {
  if (items.length === 0) {
    return <p className="text-sm text-foreground/50">Sin fechas especiales en los próximos 30 días.</p>;
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((item) => (
        <Row key={item.id} item={item} isAdmin={isAdmin} />
      ))}
    </ul>
  );
}

function Row({ item, isAdmin }: { item: UpcomingSpecialDateItem; isAdmin: boolean }) {
  const [pending, startTransition] = useTransition();
  return (
    <li className="flex items-center gap-2 rounded-lg border border-yellow-400/30 bg-yellow-400/10 px-3 py-1.5 text-sm">
      <span className="size-2 shrink-0 rounded-full bg-yellow-500" aria-hidden />
      <span className="flex-1 truncate">
        <span className="font-medium">{formatSpecialDateLabel(item.date)}</span>
        <span className="text-foreground/60"> — {item.label}</span>
      </span>
      {isAdmin ? (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await deleteSpecialDate(item.id);
            })
          }
          aria-label="Quitar esta fecha especial"
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-foreground/40 hover:bg-foreground/10 hover:text-red-600 disabled:opacity-50"
        >
          <CloseIcon />
        </button>
      ) : null}
    </li>
  );
}
