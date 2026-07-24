"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { logout } from "@/app/(app)/actions";

const INACTIVITY_LIMIT_MS = 30 * 60 * 1000;
const WARNING_BEFORE_MS = 60 * 1000;

// Eventos que cuentan como "actividad real" del empleado, incluso sin
// conexión: taps/touches/teclado dentro del wizard (fotos, checklist, firma)
// no siempre generan un request al servidor, así que no alcanza con el
// backstop de `session.maxAge` en auth.config.ts.
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "touchstart", "wheel"] as const;

export function InactivityLogout() {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const lastActivityRef = useRef<number | null>(null);
  const loggingOutRef = useRef(false);

  const signOutNow = useCallback(() => {
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;
    void logout();
  }, []);

  const registerActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    setSecondsLeft(null);
  }, []);

  useEffect(() => {
    lastActivityRef.current = Date.now();
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, registerActivity, { passive: true });
    }
    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, registerActivity);
      }
    };
  }, [registerActivity]);

  useEffect(() => {
    const tick = () => {
      if (loggingOutRef.current || lastActivityRef.current === null) return;
      const idleFor = Date.now() - lastActivityRef.current;

      if (idleFor >= INACTIVITY_LIMIT_MS) {
        signOutNow();
        return;
      }

      const remaining = INACTIVITY_LIMIT_MS - idleFor;
      setSecondsLeft(remaining <= WARNING_BEFORE_MS ? Math.ceil(remaining / 1000) : null);
    };

    // Corre cada segundo (barato) y también al volver a la pestaña, para no
    // depender de que un `setTimeout` largo sobreviva al tab en background.
    const interval = window.setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [signOutNow]);

  if (secondsLeft === null) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-xl border border-foreground/10 bg-background p-5 text-center shadow-lg">
        <p className="text-base font-semibold">¿Seguís ahí?</p>
        <p className="mt-2 text-sm text-foreground/70">
          Por inactividad, la sesión se cierra en {secondsLeft}s.
        </p>
        <Button className="mt-4 w-full" onClick={registerActivity}>
          Seguir conectado
        </Button>
      </div>
    </div>
  );
}
