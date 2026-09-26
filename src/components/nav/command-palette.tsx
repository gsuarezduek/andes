"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { filterCommands, getCommands } from "@/lib/command-palette";
import { SearchIcon } from "@/components/ui/icons";

/**
 * Paleta de comandos: Ctrl/⌘ + K abre un buscador para saltar a cualquier
 * sección sin recorrer la barra. Flechas para moverse, Enter para ir, Esc para
 * cerrar. El estado de abierto/cerrado vive en `AppNav` (lo comparten el atajo
 * y los botones del header); acá solo se monta el contenido cuando está
 * abierto, así la búsqueda y la selección arrancan limpias cada vez.
 */
export function CommandPalette({
  open,
  onClose,
  isAdmin,
}: {
  open: boolean;
  onClose: () => void;
  isAdmin: boolean;
}) {
  if (!open) return null;
  return <PaletteContent onClose={onClose} isAdmin={isAdmin} />;
}

function PaletteContent({ onClose, isAdmin }: { onClose: () => void; isAdmin: boolean }) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const activeRef = useRef<HTMLLIElement>(null);

  const results = useMemo(() => filterCommands(getCommands(isAdmin), query), [isAdmin, query]);
  // Si la lista se achica al tipear, el índice no puede quedar afuera.
  const activeIndex = Math.min(active, Math.max(results.length - 1, 0));

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, results]);

  function go(index: number) {
    const target = results[index];
    if (!target) return;
    onClose();
    router.push(target.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive(results.length ? (activeIndex + 1) % results.length : 0);
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive(results.length ? (activeIndex - 1 + results.length) % results.length : 0);
        break;
      case "Enter":
        // Con IME (composición) Enter confirma el texto, no navega.
        if (e.nativeEvent.isComposing) return;
        e.preventDefault();
        go(activeIndex);
        break;
      case "Escape":
        e.preventDefault();
        onClose();
        break;
      case "Tab":
        // El único control es el buscador: que Tab no saque el foco del diálogo.
        e.preventDefault();
        break;
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[12vh]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Buscar sección"
        className="w-full max-w-lg overflow-hidden rounded-xl border border-foreground/10 bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-2 border-b border-foreground/10 px-4">
          <SearchIcon className="size-[18px] shrink-0 text-foreground/40" />
          <input
            autoFocus
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={results.length ? `${listId}-${activeIndex}` : undefined}
            aria-autocomplete="list"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            placeholder="Ir a…  (alquileres, caja, medios de pago)"
            // 16px: por debajo iOS hace zoom al enfocar el campo. El outline va
            // inline porque el `:focus-visible` global (sin layer) le gana a la
            // utilidad; acá el propio diálogo ya enmarca el único control.
            style={{ outline: "none" }}
            className="h-12 w-full bg-transparent text-base placeholder:text-foreground/40"
          />
          <kbd className="hidden shrink-0 rounded border border-foreground/15 px-1.5 py-0.5 text-[10px] font-medium text-foreground/50 sm:block">
            Esc
          </kbd>
        </div>

        {results.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-foreground/50">
            Sin resultados para «{query.trim()}».
          </p>
        ) : (
          <ul id={listId} role="listbox" aria-label="Secciones" className="max-h-[50vh] overflow-y-auto p-2">
            {results.map((cmd, i) => {
              const selected = i === activeIndex;
              return (
                <li
                  key={cmd.id}
                  id={`${listId}-${i}`}
                  ref={selected ? activeRef : undefined}
                  role="option"
                  aria-selected={selected}
                  onMouseMove={() => setActive(i)}
                  onClick={() => go(i)}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-sm ${
                    selected ? "bg-foreground/10 text-foreground" : "text-foreground/80"
                  }`}
                >
                  <span className="truncate font-medium">{cmd.label}</span>
                  <span className="shrink-0 text-xs text-foreground/40">{cmd.group}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Botón de lupa del header (desktop y mobile). */
export function CommandPaletteButton({ onOpen, className = "" }: { onOpen: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Buscar sección"
      aria-haspopup="dialog"
      title="Buscar sección (Ctrl/⌘ K)"
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground ${className}`}
    >
      <SearchIcon />
    </button>
  );
}
