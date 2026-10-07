"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { activeMentionQuery, insertMention, matchMentionCandidates } from "@/lib/mention";

export type MentionCandidate = { id: string; name: string };

const MAX_SUGGESTIONS = 6;

/**
 * Textarea con autocompletado de @menciones (equipo) — mientras se tipea,
 * busca el último "@" antes del cursor (sin espacios desde ahí) y, si hay
 * alguno, abre un desplegable con las coincidencias. Elegir una inserta
 * "@Nombre " en el texto y deja el id elegido en un input oculto
 * (`mentionedUserId`) para que el server action lo lea sin tener que volver
 * a parsear el texto — ver `addRentalNote`.
 *
 * Si después de elegir se edita el texto y se borra esa mención, se invalida
 * sola (compara contra el texto insertado) para no mandar un
 * `mentionedUserId` que ya no corresponde a nada visible en la nota.
 *
 * Controlado a propósito: el formulario que lo envuelve (`<form action>`)
 * resetea los campos no controlados tras un submit exitoso, pero un input
 * controlado no se entera — el caller debe pasar una `key` que cambie al
 * guardar (mismo patrón que el resto de la app) para forzar el remount y
 * volver a vacío.
 */
export function MentionTextarea({
  id = "text",
  candidates,
  placeholder,
  rows = 2,
  required,
}: {
  id?: string;
  candidates: MentionCandidate[];
  placeholder?: string;
  rows?: number;
  required?: boolean;
}) {
  const [text, setText] = useState("");
  const [mention, setMention] = useState<{ userId: string; insertedText: string } | null>(null);
  const [query, setQuery] = useState<string | null>(null); // null = cerrado
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Dónde dejar el cursor después de insertar una mención — en un ref (no
  // estado: aplicarlo no necesita re-render) y disparado por un contador que
  // sí es estado, para que el efecto corra aunque se elija la misma posición
  // dos veces seguidas. Se aplica en `useLayoutEffect`, sincronizado con el
  // commit del DOM. Haciéndolo con `requestAnimationFrame` en vez de esto, si
  // el usuario retomaba a escribir rápido (automatizado o no) la tecla podía
  // llegar al textarea ANTES de que el frame reposicionara el cursor al
  // final de "@Nombre " — el navegador la insertaba donde el cursor había
  // quedado de antes (en medio de la mención recién tipeada) y corrompía el
  // texto.
  const pendingCaretRef = useRef<number | null>(null);
  const [caretTick, setCaretTick] = useState(0);

  const matches = useMemo(
    () => (query === null ? [] : matchMentionCandidates(candidates, query, MAX_SUGGESTIONS)),
    [query, candidates],
  );

  useLayoutEffect(() => {
    const pos = pendingCaretRef.current;
    if (pos === null) return;
    const el = textareaRef.current;
    if (el) {
      el.focus();
      el.setSelectionRange(pos, pos);
    }
  }, [caretTick]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setText(value);
    if (mention && !value.includes(mention.insertedText)) setMention(null);
    setQuery(activeMentionQuery(value, e.target.selectionStart ?? value.length));
  }

  function pick(candidate: MentionCandidate) {
    const el = textareaRef.current;
    if (!el) return;
    const result = insertMention(text, el.selectionStart ?? text.length, candidate.name);
    if (!result) return;
    setText(result.text);
    setMention({ userId: candidate.id, insertedText: result.insertedText });
    setQuery(null);
    pendingCaretRef.current = result.caret;
    setCaretTick((t) => t + 1);
  }

  return (
    <div className="relative min-w-0 flex-1">
      <textarea
        ref={textareaRef}
        id={id}
        name={id}
        required={required}
        rows={rows}
        placeholder={placeholder}
        value={text}
        onChange={handleChange}
        // El timeout deja que un click en la lista (que dispara blur primero)
        // llegue a procesarse antes de cerrar el desplegable.
        onBlur={() => setTimeout(() => setQuery(null), 150)}
        className="w-full rounded-lg border border-foreground/15 bg-transparent px-3 py-2 text-sm"
      />
      <input type="hidden" name="mentionedUserId" value={mention?.userId ?? ""} />
      {query !== null && matches.length > 0 && (
        <ul className="absolute z-20 mt-1 w-56 rounded-lg border border-foreground/15 bg-background py-1 shadow-lg">
          {matches.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(c)}
                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-foreground/5"
              >
                @{c.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
