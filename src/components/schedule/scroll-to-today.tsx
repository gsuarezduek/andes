"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Caja con scroll horizontal que arranca mostrando la columna marcada con `data-today` (en el celular "hoy" queda fuera de vista si no). */
export function ScrollToToday({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = ref.current;
    const today = box?.querySelector<HTMLElement>("[data-today]");
    if (!box || !today) return;
    // Deja visible la columna fija de rótulos (~80px) a la izquierda de "hoy".
    box.scrollLeft = Math.max(0, today.getBoundingClientRect().left - box.getBoundingClientRect().left + box.scrollLeft - 88);
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
