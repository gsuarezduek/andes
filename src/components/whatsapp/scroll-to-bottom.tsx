"use client";

import { useEffect } from "react";

/**
 * Al abrir un chat, arranca mostrando los mensajes más recientes (abajo) en
 * vez del principio de la conversación — la página no tiene un contenedor de
 * scroll propio para el hilo (ver ConversationThread), así que se scrollea la
 * ventana entera. Solo al montar: los auto-refresh posteriores (ver
 * AutoRefresh) no vuelven a moverlo, así no le pisa el scroll a alguien
 * releyendo historial viejo. Se repite una vez más a los 200ms por si algún
 * adjunto (foto) todavía no cargó y corrió el alto de la página.
 */
export function ScrollToBottom() {
  useEffect(() => {
    const scroll = () => window.scrollTo(0, document.documentElement.scrollHeight);
    scroll();
    const t = setTimeout(scroll, 200);
    return () => clearTimeout(t);
  }, []);
  return null;
}
