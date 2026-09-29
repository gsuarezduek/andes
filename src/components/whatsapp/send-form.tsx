"use client";

import { useActionState, useRef, useEffect, useCallback, useMemo, useState, type KeyboardEvent } from "react";
import { FormError } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { sendMessage, type MessageActionState } from "@/app/(app)/whatsapp/actions";
import { matchQuickReplies } from "@/lib/whatsapp/quick-reply-match";
import type { QuickReplyOption } from "@/lib/whatsapp/quick-replies";
import { QuickReplyDropdown } from "@/components/whatsapp/quick-reply-dropdown";
import { QuickReplyManagerModal } from "@/components/whatsapp/quick-reply-manager";

const initialState: MessageActionState = {};

export function SendForm({ conversationId, quickReplies }: { conversationId: string; quickReplies: QuickReplyOption[] }) {
  const action = sendMessage.bind(null, conversationId);
  const [state, formAction] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Plantillas rápidas ("/") — ver quick-reply-match.ts. `replies` es la
  // lista viva (se actualiza sola al crear/editar/borrar desde el modal, sin
  // recargar la conversación).
  const [replies, setReplies] = useState(quickReplies);
  const [slashQuery, setSlashQuery] = useState<string | null>(null); // null = cerrado
  const [suppressed, setSuppressed] = useState(false); // Escape lo cierra hasta la próxima tecla
  const [activeIndex, setActiveIndex] = useState(0);
  const [managerOpen, setManagerOpen] = useState(false);
  const [managerSeed, setManagerSeed] = useState<string | undefined>(undefined);

  const filtered = useMemo(() => matchQuickReplies(replies, slashQuery ?? ""), [replies, slashQuery]);
  const dropdownOpen = slashQuery !== null && !suppressed;
  const clampedIndex = Math.min(activeIndex, Math.max(filtered.length - 1, 0));

  // Ajusta el alto al contenido (hasta el tope de max-h en el className).
  const autoResize = useCallback(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => {
    if (!state.error) {
      formRef.current?.reset();
      // reset() no dispara "input", así que volvemos al alto inicial a mano.
      autoResize();
    }
  }, [state, autoResize]);

  // Escribir "/" como primer carácter del mensaje muestra la lista — igual
  // que "Respuestas rápidas" en la app de WhatsApp Business.
  function handleInput() {
    autoResize();
    setSuppressed(false);
    const value = textRef.current?.value ?? "";
    const firstLine = value.split("\n", 1)[0];
    setSlashQuery(firstLine.startsWith("/") ? firstLine.slice(1) : null);
  }

  function insertReplyText(text: string) {
    const el = textRef.current;
    if (!el) return;
    el.value = text;
    setSlashQuery(null);
    autoResize();
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }

  function openManager(seed?: string) {
    setManagerSeed(seed);
    setManagerOpen(true);
    setSlashQuery(null);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (!dropdownOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered.length > 0) insertReplyText(filtered[clampedIndex].text);
      else openManager(slashQuery || undefined);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setSuppressed(true);
    }
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      onSubmit={() => setSlashQuery(null)} // cierra el picker al enviar, no hace falta esperar el resultado
      className="flex flex-col gap-2 border-t border-foreground/10 pt-3"
    >
      <FormError>{state.error}</FormError>
      <div className="relative flex items-end gap-2">
        {dropdownOpen && (
          <QuickReplyDropdown
            replies={filtered}
            query={slashQuery ?? ""}
            activeIndex={clampedIndex}
            onHover={setActiveIndex}
            onSelect={(r) => insertReplyText(r.text)}
            onManage={() => openManager(slashQuery || undefined)}
          />
        )}
        <textarea
          ref={textRef}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onBlur={() => window.setTimeout(() => setSuppressed(true), 150)}
          onFocus={() => setSuppressed(false)}
          name="text"
          rows={2}
          placeholder='Escribí un mensaje… (probá "/" para una plantilla)'
          required
          className="max-h-[40vh] min-h-[2.5rem] w-full flex-1 resize-none rounded-lg border border-foreground/15 bg-transparent p-2.5 text-base outline-none focus:border-foreground/40"
        />
        <SubmitButton pendingLabel="Enviando…">Enviar</SubmitButton>
      </div>
      <button
        type="button"
        onClick={() => openManager()}
        className="self-start text-xs font-medium text-foreground/50 hover:text-foreground"
      >
        🗂️ Plantillas rápidas <span className="text-foreground/35">(o escribí &quot;/&quot;)</span>
      </button>

      <QuickReplyManagerModal
        open={managerOpen}
        onClose={() => setManagerOpen(false)}
        replies={replies}
        onChange={setReplies}
        onUse={insertReplyText}
        initialShortcut={managerSeed}
      />
    </form>
  );
}
