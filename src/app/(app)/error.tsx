"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Red de contención genérica para errores no controlados dentro de la app
 * (server actions que revientan sin su propio manejo, bugs, etc.) — antes,
 * cualquiera de estos mostraba la pantalla de error técnica por defecto de
 * Next/React en vez de algo en español acorde al resto de la app.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
      <h1 className="text-xl font-bold tracking-tight">Algo salió mal</h1>
      <p className="text-sm text-foreground/60">
        Ocurrió un error inesperado. Podés intentar de nuevo o volver al inicio; si el problema
        sigue, avisale al administrador.
      </p>
      <div className="flex gap-3">
        <Button type="button" onClick={reset}>Reintentar</Button>
        <Button type="button" variant="secondary" onClick={() => { window.location.href = "/"; }}>
          Ir al inicio
        </Button>
      </div>
    </div>
  );
}
