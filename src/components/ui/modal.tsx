"use client";

import { useEffect, useId, useRef } from "react";
import type { ReactNode } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Modal genérico: overlay + panel con role="dialog", foco atrapado adentro
 * mientras está abierto (Tab/Shift+Tab no se escapa al resto de la página) y
 * foco inicial en el primer control. Sin `onClose` (ej. el aviso de
 * inactividad), ni el click afuera ni Escape lo cierran — la única salida es
 * la acción explícita que ofrezca el contenido.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  className = "max-w-sm",
}: {
  open: boolean;
  onClose?: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Foco inicial: solo cuando el modal pasa a abierto. Aparte del listener de
  // abajo a propósito — si dependiera también de `onClose`, cada re-render
  // del que abre el modal con un `onClose={() => ...}` inline (la forma
  // habitual) recrea esa función, dispara este efecto de nuevo y devuelve el
  // foco al primer campo en cada tecla que el usuario escribe más adelante
  // en el formulario (así se manifestaba: escribir en un input tipeaba un
  // carácter y perdía el foco al toque).
  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (first ?? panel)?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (!onClose) return;
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusable.length === 0) return;
      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={`w-full rounded-xl border border-foreground/10 bg-background p-5 shadow-xl outline-none ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {title ? (
          <p id={titleId} className="mb-4 text-sm font-semibold text-foreground/90">
            {title}
          </p>
        ) : null}
        {children}
      </div>
    </div>
  );
}
