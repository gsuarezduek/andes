"use client";

import { useTransition } from "react";
import { clearServiceSnooze } from "@/app/(app)/vehicles/[id]/service-snooze-actions";

/** "Reactivar": deshace el "Posponer" de la alerta de service. */
export function ClearServiceSnoozeButton({ vehicleId }: { vehicleId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => clearServiceSnooze(vehicleId))}
      className="ml-2 text-xs font-medium underline underline-offset-2 text-foreground/60 hover:text-foreground disabled:opacity-50"
    >
      {pending ? "…" : "Reactivar"}
    </button>
  );
}
