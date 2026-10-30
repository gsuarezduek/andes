"use client";

import { useFormStatus } from "react-dom";
import { completeTask } from "@/app/(app)/tasks/actions";

function SubmitDone() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="shrink-0 text-xs font-medium text-emerald-600 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {pending ? "Marcando…" : "Hecha"}
    </button>
  );
}

/**
 * "Hecha" de una tarea en la Agenda. Sin el lock compartido de HomeTaskList:
 * acá la tarea completada no desaparece ni reordena la lista (queda tachada
 * en su lugar), así que un segundo click no puede caer sobre otra fila.
 */
export function AgendaTaskDone({ taskId }: { taskId: string }) {
  return (
    <form action={completeTask.bind(null, taskId)}>
      <SubmitDone />
    </form>
  );
}
