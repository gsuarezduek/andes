"use client";

import { useActionState, useRef, useEffect, useCallback } from "react";
import { FormError } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { sendMessage, type MessageActionState } from "@/app/(app)/whatsapp/actions";

const initialState: MessageActionState = {};

export function SendForm({ conversationId }: { conversationId: string }) {
  const action = sendMessage.bind(null, conversationId);
  const [state, formAction] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

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

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2 border-t border-foreground/10 pt-3">
      <FormError>{state.error}</FormError>
      <div className="flex items-end gap-2">
        <textarea
          ref={textRef}
          onInput={autoResize}
          name="text"
          rows={2}
          placeholder="Escribí un mensaje…"
          required
          className="max-h-[40vh] min-h-[2.5rem] w-full flex-1 resize-none rounded-lg border border-foreground/15 bg-transparent p-2.5 text-base outline-none focus:border-foreground/40"
        />
        <SubmitButton pendingLabel="Enviando…">Enviar</SubmitButton>
      </div>
    </form>
  );
}
