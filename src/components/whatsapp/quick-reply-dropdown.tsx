"use client";

import type { QuickReplyOption } from "@/lib/whatsapp/quick-replies";

/**
 * Lista flotante que aparece arriba del compositor al escribir "/" (ver
 * SendForm) — mismo estilo que el buscador del Home (home-search.tsx).
 * Puramente presentacional: la navegación con flechas/Enter/Escape vive en
 * SendForm, que además intercepta el teclado de la textarea.
 */
export function QuickReplyDropdown({
  replies,
  query,
  activeIndex,
  onHover,
  onSelect,
  onManage,
}: {
  replies: QuickReplyOption[];
  query: string;
  activeIndex: number;
  onHover: (index: number) => void;
  onSelect: (reply: QuickReplyOption) => void;
  onManage: () => void;
}) {
  return (
    <div className="absolute bottom-full left-0 z-20 mb-1 w-full max-w-sm overflow-hidden rounded-lg border border-foreground/10 bg-background shadow-lg">
      {replies.length > 0 ? (
        <ul className="max-h-64 overflow-y-auto py-1">
          {replies.map((r, i) => (
            <li key={r.id}>
              <button
                type="button"
                onMouseEnter={() => onHover(i)}
                onClick={() => onSelect(r)}
                className={`block w-full px-3 py-2 text-left text-sm ${i === activeIndex ? "bg-foreground/10" : "hover:bg-foreground/5"}`}
              >
                <p className="font-medium">/{r.shortcut}</p>
                <p className="truncate text-xs text-foreground/60">{r.text}</p>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-3 py-2 text-sm text-foreground/50">
          {query ? `Ninguna plantilla con "/${query}".` : "Todavía no hay plantillas creadas."}
        </p>
      )}
      <button
        type="button"
        onClick={onManage}
        className="block w-full border-t border-foreground/10 px-3 py-2 text-left text-xs font-medium text-foreground/60 hover:bg-foreground/5 hover:text-foreground"
      >
        {query ? `✏️ Crear "/${query}" o administrar plantillas` : "✏️ Crear o administrar plantillas"}
      </button>
    </div>
  );
}
