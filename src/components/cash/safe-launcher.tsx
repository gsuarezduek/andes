"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SafeMovementForm } from "./safe-movement-form";

/** Botón que abre `SafeMovementForm` — antes vivía en `MovementLauncher`,
 *  ahora la caja fuerte tiene su propia pestaña con su propio lanzador. */
export function SafeLauncher() {
  const [open, setOpen] = useState(false);

  if (open) return <SafeMovementForm onCancel={() => setOpen(false)} />;

  return (
    <Button type="button" onClick={() => setOpen(true)}>
      + Movimiento de caja fuerte
    </Button>
  );
}
