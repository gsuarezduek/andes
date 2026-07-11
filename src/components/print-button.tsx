"use client";

import { Button } from "@/components/ui/button";

/** Botón que dispara el diálogo de impresión del navegador. */
export function PrintButton({ children = "Imprimir" }: { children?: React.ReactNode }) {
  return (
    <Button type="button" onClick={() => window.print()} className="no-print">
      {children}
    </Button>
  );
}
