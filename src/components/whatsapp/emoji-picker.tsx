"use client";

import { useEffect, useRef } from "react";
import { EMOJI_LIST } from "@/lib/emoji-list";

/**
 * Popover de emojis sobre el botón que lo abre — se cierra solo al clickear
 * afuera o con Escape (igual que QuickReplyDropdown, pero sin filtro: la
 * lista es chica y fija). Elegir un emoji NO cierra el popover — se puede
 * sumar más de uno antes de cerrarlo a mano.
 */
export function EmojiPicker({ onSelect, onClose }: { onSelect: (emoji: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute bottom-full left-0 z-20 mb-1 grid w-64 grid-cols-8 gap-1 rounded-lg border border-foreground/10 bg-background p-2 shadow-lg"
    >
      {EMOJI_LIST.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onSelect(emoji)}
          className="flex h-8 w-8 items-center justify-center rounded text-lg hover:bg-foreground/10"
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}
