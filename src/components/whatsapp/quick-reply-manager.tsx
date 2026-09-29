"use client";

import { useState, useTransition, type FormEvent } from "react";
import { TextField, TextareaField, FormError } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { ConfirmDeleteCard } from "@/components/ui/confirm-delete-card";
import { createQuickReply, updateQuickReply, deleteQuickReply } from "@/app/(app)/whatsapp/quick-reply-actions";
import type { QuickReplyOption } from "@/lib/whatsapp/quick-replies";

function CreateForm({
  initialShortcut,
  onCreated,
}: {
  initialShortcut?: string;
  onCreated: (reply: QuickReplyOption) => void;
}) {
  const [shortcut, setShortcut] = useState(initialShortcut ?? "");
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(undefined);
    start(async () => {
      const result = await createQuickReply({}, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.reply) {
        onCreated(result.reply);
        setShortcut("");
        setText("");
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 rounded-lg border border-foreground/10 p-3">
      <FormError>{error}</FormError>
      <TextField
        id="shortcut"
        label="Atajo"
        prefix="/"
        value={shortcut}
        onChange={(e) => setShortcut(e.target.value)}
        placeholder="horario"
        required
      />
      <TextareaField
        id="text"
        label="Texto"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Nuestro horario es de 9 a 18…"
        required
        rows={3}
      />
      <Button type="submit" variant="secondary" className="self-start" disabled={pending}>
        {pending ? "Creando…" : "+ Crear plantilla"}
      </Button>
    </form>
  );
}

function QuickReplyRow({
  reply,
  onUse,
  onUpdated,
  onDeleted,
}: {
  reply: QuickReplyOption;
  onUse?: (text: string) => void;
  onUpdated: (reply: QuickReplyOption) => void;
  onDeleted: (id: string) => void;
}) {
  const [mode, setMode] = useState<"view" | "edit" | "confirmDelete">("view");
  const [shortcut, setShortcut] = useState(reply.shortcut);
  const [text, setText] = useState(reply.text);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(undefined);
    start(async () => {
      const result = await updateQuickReply(reply.id, {}, formData);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.reply) {
        onUpdated(result.reply);
        setMode("view");
      }
    });
  }

  if (mode === "confirmDelete") {
    return (
      <ConfirmDeleteCard
        as="div"
        message={`¿Eliminar la plantilla "/${reply.shortcut}"?`}
        action={async () => {
          await deleteQuickReply(reply.id);
          onDeleted(reply.id);
        }}
        onCancel={() => setMode("view")}
      />
    );
  }

  if (mode === "edit") {
    return (
      <li className="rounded-lg border border-foreground/15 p-3">
        <form onSubmit={submit} className="flex flex-col gap-2">
          <FormError>{error}</FormError>
          <TextField id="shortcut" label="Atajo" prefix="/" value={shortcut} onChange={(e) => setShortcut(e.target.value)} required />
          <TextareaField id="text" label="Texto" value={text} onChange={(e) => setText(e.target.value)} required rows={3} />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setShortcut(reply.shortcut);
                setText(reply.text);
                setError(undefined);
                setMode("view");
              }}
              className="text-xs text-foreground/50"
            >
              Cancelar
            </button>
            <Button type="submit" disabled={pending} className="ml-auto h-auto px-2.5 py-1 text-xs">
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-1 px-1 py-2.5 text-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 font-medium">/{reply.shortcut}</p>
        <div className="flex shrink-0 items-center gap-2 text-xs">
          {onUse && (
            <button type="button" onClick={() => onUse(reply.text)} className="font-medium text-emerald-700 hover:underline dark:text-emerald-400">
              Usar
            </button>
          )}
          <button type="button" onClick={() => setMode("edit")} className="text-foreground/50 hover:text-foreground">
            Editar
          </button>
          <button type="button" onClick={() => setMode("confirmDelete")} className="text-foreground/40 hover:text-red-600">
            Eliminar
          </button>
        </div>
      </div>
      <p className="whitespace-pre-wrap text-foreground/60">{reply.text}</p>
    </li>
  );
}

/**
 * Administración completa de plantillas rápidas: crear, editar, borrar y
 * (si `onUse` está disponible) insertar directo en el compositor sin cerrar
 * el modal en el medio de escribir. Compartidas para todo el equipo — mismo
 * criterio que las notas.
 */
export function QuickReplyManagerModal({
  open,
  onClose,
  replies,
  onChange,
  onUse,
  initialShortcut,
}: {
  open: boolean;
  onClose: () => void;
  replies: QuickReplyOption[];
  onChange: (next: QuickReplyOption[]) => void;
  onUse?: (text: string) => void;
  initialShortcut?: string;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Plantillas rápidas" className="max-w-lg">
      <p className="mb-3 text-xs text-foreground/50">
        Se invocan escribiendo <span className="font-medium">/</span> seguido del atajo, al escribir un mensaje.
      </p>
      <CreateForm
        initialShortcut={initialShortcut}
        onCreated={(reply) => onChange([...replies, reply].sort((a, b) => a.shortcut.localeCompare(b.shortcut)))}
      />
      {replies.length > 0 ? (
        <ul className="mt-3 flex max-h-80 flex-col divide-y divide-foreground/10 overflow-y-auto">
          {replies.map((r) => (
            <QuickReplyRow
              key={r.id}
              reply={r}
              onUse={
                onUse
                  ? (text) => {
                      onUse(text);
                      onClose();
                    }
                  : undefined
              }
              onUpdated={(updated) =>
                onChange(replies.map((r2) => (r2.id === updated.id ? updated : r2)).sort((a, b) => a.shortcut.localeCompare(b.shortcut)))
              }
              onDeleted={(id) => onChange(replies.filter((r2) => r2.id !== id))}
            />
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-foreground/50">Todavía no hay ninguna plantilla creada.</p>
      )}
      <div className="mt-4 flex justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </Modal>
  );
}
