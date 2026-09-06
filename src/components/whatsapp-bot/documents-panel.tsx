"use client";

import { useActionState, useRef, useEffect } from "react";
import { FormError } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { Badge } from "@/components/ui/badge";
import { uploadBotDocument, deleteBotDocument, type ActionState } from "@/app/(app)/settings/whatsapp/bot/actions";

const initialState: ActionState = {};

type Doc = { id: string; fileName: string; sizeBytes: number; truncated: boolean; summarized: boolean; createdAt: Date };

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentsPanel({ documents, maxDocuments }: { documents: Doc[]; maxDocuments: number }) {
  const [state, formAction] = useActionState(uploadBotDocument, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const atLimit = documents.length >= maxDocuments;

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-foreground/60">
        PDF, DOCX o TXT — brochure de servicios, FAQ, condiciones. El texto se extrae una sola vez al subir (máximo{" "}
        {maxDocuments} documentos).
      </p>
      <form ref={formRef} action={formAction} className="flex items-end gap-2">
        <FormError>{state.error}</FormError>
        <input
          type="file"
          name="file"
          accept=".pdf,.docx,.txt"
          disabled={atLimit}
          required
          className="text-sm file:mr-3 file:rounded-lg file:border file:border-foreground/15 file:bg-transparent file:px-3 file:py-2 file:text-sm"
        />
        <SubmitButton pendingLabel="Subiendo…" disabled={atLimit}>
          Subir
        </SubmitButton>
      </form>
      {atLimit ? <p className="text-xs text-amber-600 dark:text-amber-400">Llegaste al máximo — borrá alguno para subir otro.</p> : null}

      {documents.length === 0 ? (
        <p className="text-sm text-foreground/50">Todavía no hay documentos.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
          {documents.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <div>
                <p className="font-medium">{d.fileName}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-foreground/50">
                  <span>{formatSize(d.sizeBytes)}</span>
                  {d.summarized ? <Badge tone="blue">Resumido con IA</Badge> : null}
                  {d.truncated ? <Badge tone="amber">Recortado</Badge> : null}
                </div>
              </div>
              <form action={deleteBotDocument.bind(null, d.id)}>
                <button type="submit" className="text-xs text-foreground/40 hover:text-red-600">
                  Eliminar
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
