"use client";

import { useCallback, useRef } from "react";

/** Para campos de texto: espera a que el usuario deje de tipear antes de guardar. */
export function useDebouncedCallback<A extends unknown[]>(fn: (...args: A) => void, delayMs: number) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  return useCallback(
    (...args: A) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => fn(...args), delayMs);
    },
    [fn, delayMs],
  );
}
