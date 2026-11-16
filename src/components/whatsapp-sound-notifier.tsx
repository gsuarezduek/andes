"use client";

import { useEffect, useRef } from "react";

const POLL_MS = 10000;

/** Beep corto vía Web Audio API — no hace falta ningún archivo de sonido. */
function beep() {
  try {
    const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
    osc.onended = () => ctx.close();
  } catch {
    // El navegador puede bloquear audio sin interacción previa del usuario —
    // se resuelve solo apenas alguien haga click en algo de la app.
  }
}

/** Conteo vía ruta (no Server Action): sigue andando en pestañas abiertas antes de un deploy. */
async function fetchInboundCount(): Promise<number | null> {
  try {
    const res = await fetch("/api/whatsapp/inbound-count", { cache: "no-store" });
    if (!res.ok) return null;
    const data: { count?: unknown } = await res.json();
    return typeof data.count === "number" ? data.count : null;
  } catch {
    return null;
  }
}

/**
 * Sonido corto cada vez que llega un mensaje nuevo de WhatsApp — cuenta TODOS
 * los mensajes entrantes recibidos alguna vez (no "no leídos": ese es un
 * estado derivado que puede no reflejar la llegada si la conversación ya
 * estaba abierta). Funciona en cualquier pantalla de la app (montado en el
 * layout), no solo con `/whatsapp` abierto. La primera lectura solo fija la
 * base, para no sonar apenas se carga la página.
 */
export function WhatsappSoundNotifier() {
  const lastCountRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      // Pausado con la pestaña en segundo plano (mismo criterio que
      // `AutoRefresh`); al volver, la primera lectura suena si llegó algo.
      if (document.visibilityState !== "visible") return;
      const count = await fetchInboundCount();
      if (cancelled || count === null) return;
      if (lastCountRef.current !== null && count > lastCountRef.current) {
        beep();
      }
      lastCountRef.current = count;
    };

    poll();
    const interval = window.setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  return null;
}
