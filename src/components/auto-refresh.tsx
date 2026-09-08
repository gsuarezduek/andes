"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Refresca los datos del server component actual cada `intervalMs` — Andes
 * no usa WebSockets en ningún lado, esto es "recarga de página" (el patrón
 * de siempre) automatizada en vez de manual. Se pausa con la pestaña en
 * background (`visibilitychange`) para no gastar requests de más.
 */
export function AutoRefresh({ intervalMs }: { intervalMs: number }) {
  const router = useRouter();
  const routerRef = useRef(router);

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") routerRef.current.refresh();
    };
    const interval = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(interval);
  }, [intervalMs]);

  return null;
}
