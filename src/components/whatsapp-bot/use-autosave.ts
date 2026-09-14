"use client";

import { useCallback, useRef, useState, useTransition } from "react";

/**
 * Dispara una Server Action en cada cambio (sin botón "Guardar") y expone un
 * estado transitorio "Guardando…" / "Guardado ✓" para que quede claro que ya
 * persistió — antes era fácil cargar algo, verlo en pantalla, y salir
 * pensando que había quedado guardado sin haber tocado el botón.
 */
export function useAutosave() {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const clearRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = useCallback((action: () => Promise<unknown>) => {
    startTransition(async () => {
      await action();
      setSaved(true);
      if (clearRef.current) clearTimeout(clearRef.current);
      clearRef.current = setTimeout(() => setSaved(false), 2000);
    });
  }, []);

  return { pending, saved, run };
}
