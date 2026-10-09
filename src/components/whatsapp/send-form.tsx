"use client";

import { useActionState, useRef, useEffect, useCallback, useMemo, useState, type KeyboardEvent, type ChangeEvent } from "react";
import { FormError } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { sendMessage, type MessageActionState } from "@/app/(app)/whatsapp/actions";
import { matchQuickReplies } from "@/lib/whatsapp/quick-reply-match";
import type { QuickReplyOption } from "@/lib/whatsapp/quick-replies";
import { QuickReplyDropdown } from "@/components/whatsapp/quick-reply-dropdown";
import { QuickReplyManagerModal } from "@/components/whatsapp/quick-reply-manager";
import { EmojiPicker } from "@/components/whatsapp/emoji-picker";
import { AttachmentPreview } from "@/components/whatsapp/attachment-preview";

const initialState: MessageActionState = {};
const MAX_ATTACHMENT_BYTES = 16 * 1024 * 1024; // 16 MB — mismo tope que valida el servidor (ver whatsapp/actions.ts)

export function SendForm({ conversationId, quickReplies }: { conversationId: string; quickReplies: QuickReplyOption[] }) {
  const action = sendMessage.bind(null, conversationId);
  const [state, formAction] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Plantillas rápidas ("/") — ver quick-reply-match.ts. `replies` es la
  // lista viva (se actualiza sola al crear/editar/borrar desde el modal, sin
  // recargar la conversación).
  const [replies, setReplies] = useState(quickReplies);
  const [slashQuery, setSlashQuery] = useState<string | null>(null); // null = cerrado
  const [suppressed, setSuppressed] = useState(false); // Escape lo cierra hasta la próxima tecla
  const [activeIndex, setActiveIndex] = useState(0);
  const [managerOpen, setManagerOpen] = useState(false);
  const [managerSeed, setManagerSeed] = useState<string | undefined>(undefined);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [attachedPreviewUrl, setAttachedPreviewUrl] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string>();

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

  // Red de seguridad si el componente se desmonta con un adjunto todavía
  // puesto (ej. se navega a otra conversación) — en el camino normal ya se
  // libera a mano en setAttachment, esto solo evita la pérdida de memoria del
  // caso borde. Sin setState acá, no dispara el lint de abajo.
  useEffect(() => {
    return () => {
      if (attachedPreviewUrl) URL.revokeObjectURL(attachedPreviewUrl);
    };
  }, [attachedPreviewUrl]);

  // Escribir "/" como primer carácter del mensaje muestra la lista — igual
  // que "Respuestas rápidas" en la app de WhatsApp Business.
  function handleInput() {
    autoResize();
    setSuppressed(false);
    const value = textRef.current?.value ?? "";
    const firstLine = value.split("\n", 1)[0];
    const nextQuery = firstLine.startsWith("/") ? firstLine.slice(1) : null;
    setSlashQuery(nextQuery);
    if (nextQuery !== null) setEmojiOpen(false); // no superponer los dos popovers
  }

  /** Inserta en el cursor (emojis) sin pisar el resto de lo que ya se escribió. */
  function insertAtCursor(snippet: string) {
    const el = textRef.current;
    if (!el) return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    el.value = el.value.slice(0, start) + snippet + el.value.slice(end);
    autoResize();
    el.focus();
    const cursor = start + snippet.length;
    el.setSelectionRange(cursor, cursor);
  }

  /** Reemplaza todo el contenido (plantillas rápidas: elegir una es como "ejecutar un comando"). */
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

  /** Genera (y libera la anterior) la miniatura acá mismo, en el evento que
   *  elige el archivo — no en un efecto reaccionando a `attachedFile` (ver
   *  AttachmentPreview, mismo criterio que ya usa inspection-wizard.tsx). */
  function setAttachment(file: File | null) {
    if (attachedPreviewUrl) URL.revokeObjectURL(attachedPreviewUrl);
    setAttachedFile(file);
    setAttachedPreviewUrl(file && file.type.startsWith("image/") ? URL.createObjectURL(file) : null);
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setAttachmentError(undefined);
    if (!file) {
      setAttachment(null);
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      setAttachmentError("El archivo es demasiado grande (máximo 16 MB).");
      e.target.value = "";
      setAttachment(null);
      return;
    }
    setAttachment(file);
  }

  function removeAttachment() {
    setAttachment(null);
    setAttachmentError(undefined);
    if (fileInputRef.current) fileInputRef.current.value = "";
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
    <>
      <form
        ref={formRef}
        action={formAction}
        onSubmit={() => setSlashQuery(null)} // cierra el picker al enviar, no hace falta esperar el resultado
        onReset={() => {
          // Dispara cuando `formRef.current?.reset()` corre arriba (envío
          // exitoso) — recién ahí se limpia el adjunto, no al intentar
          // enviar: si falla, el archivo elegido sigue ahí para reintentar
          // (igual que el texto, que tampoco se borra en el error).
          setAttachment(null);
          setAttachmentError(undefined);
        }}
        className="flex flex-col gap-2 border-t border-foreground/10 pt-3"
      >
        <FormError>{state.error ?? attachmentError}</FormError>
        {attachedFile && (
          <AttachmentPreview file={attachedFile} previewUrl={attachedPreviewUrl} onRemove={removeAttachment} />
        )}
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
          {emojiOpen && <EmojiPicker onSelect={insertAtCursor} onClose={() => setEmojiOpen(false)} />}
          <input ref={fileInputRef} type="file" name="file" onChange={handleFileChange} className="hidden" />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Adjuntar foto o archivo"
            aria-label="Adjuntar foto o archivo"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg text-foreground/60 hover:bg-foreground/5 hover:text-foreground"
          >
            📎
          </button>
          <button
            type="button"
            onClick={() => {
              setEmojiOpen((o) => !o);
              setSuppressed(true); // no superponer con el picker de plantillas rápidas
            }}
            title="Emojis"
            aria-label="Emojis"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg text-foreground/60 hover:bg-foreground/5 hover:text-foreground"
          >
            😊
          </button>
          <textarea
            ref={textRef}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onBlur={() => window.setTimeout(() => setSuppressed(true), 150)}
            onFocus={() => setSuppressed(false)}
            name="text"
            rows={2}
            placeholder={attachedFile ? "Agregá un texto (opcional)…" : 'Escribí un mensaje… (probá "/" para una plantilla)'}
            required={!attachedFile}
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
      </form>

      {/* Fuera del <form> de arriba a propósito: el modal tiene sus propios
          <form> internos (crear/editar plantilla) y un <form> anidado dentro
          de otro es HTML inválido — el submit del de adentro terminaba
          disparando el de afuera (recargaba la página y no guardaba nada). */}
      <QuickReplyManagerModal
        open={managerOpen}
        onClose={() => setManagerOpen(false)}
        replies={replies}
        onChange={setReplies}
        onUse={insertReplyText}
        initialShortcut={managerSeed}
      />
    </>
  );
}
