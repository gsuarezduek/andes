"use client";

import { useState } from "react";
import { TextField } from "@/components/ui/fields";
import { AutosaveStatus } from "@/components/whatsapp-bot/autosave-status";
import { useAutosave } from "@/components/whatsapp-bot/use-autosave";
import { useDebouncedCallback } from "@/lib/client/use-debounced-callback";
import { updateFollowUpStaleDays } from "@/app/(app)/settings/whatsapp/bot/actions";

type StateInfo = {
  label: string;
  dot: string;
  trigger: string;
  resolves: string;
  automatic: boolean;
};

const STATES: StateInfo[] = [
  {
    label: "A confirmar",
    dot: "bg-emerald-500",
    trigger: "El bot detecta que el cliente acaba de aceptar una propuesta concreta (auto + fechas).",
    resolves: "Solo al vincular la conversación a una reserva en Andes. También hay un botón manual.",
    automatic: true,
  },
  {
    label: "Transferido",
    dot: "bg-red-500",
    trigger: "El bot no está seguro y deriva la conversación a una persona (ver pestaña Calidad).",
    resolves: "Apenas alguien manda un mensaje después de la derivación, o al reactivar el bot. También hay un botón manual.",
    automatic: true,
  },
  {
    label: "No leído",
    dot: "bg-amber-500",
    trigger: "Llegó un mensaje del cliente que todavía nadie respondió ni abrió en Andes.",
    resolves: "Al responder (Andes, el bot, o a mano desde WhatsApp) o al abrir la conversación.",
    automatic: true,
  },
  {
    label: "Confirmado",
    dot: "bg-violet-500",
    trigger: "Nunca lo prende el bot — es 100% manual, para clientes frecuentes donde ya está todo arreglado.",
    resolves: "Con el mismo botón manual que lo prende.",
    automatic: false,
  },
  {
    label: "Hacer seguimiento",
    dot: "bg-blue-500",
    trigger: 'El bot cotiza (completo o de referencia) y el cliente queda en responder ("te aviso", "lo pienso"). Se prende al instante, sin ningún plazo de espera.',
    resolves: "Apenas el cliente vuelve a escribir, o al vincular una reserva. También hay un botón manual.",
    automatic: true,
  },
  {
    label: "Leído",
    dot: "bg-foreground/20",
    trigger: "Todo lo demás — no aplica ninguno de los estados de arriba.",
    resolves: "—",
    automatic: false,
  },
];

/**
 * Explica los estados de triage del inbox (colores/prioridad en
 * conversation-list.tsx y conversationState() en whatsapp/conversations.ts)
 * y expone el único parámetro ajustable hoy: a partir de cuántos días sin
 * respuesta del cliente una conversación "A recuperar" se marca vencida
 * (naranja) en el listado — solo cambia cómo se destaca, no cuándo entra al
 * estado (eso lo decide el bot al instante).
 */
export function StatesPanel({ followUpStaleDays: initial }: { followUpStaleDays: number }) {
  const { pending, saved, run } = useAutosave();
  const [days, setDays] = useState(String(initial));

  const debouncedSave = useDebouncedCallback((value: string) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return;
    run(() => updateFollowUpStaleDays(n));
  }, 600);

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-foreground/60">
        Orden de prioridad en el listado de arriba hacia abajo (las fijadas siempre van primero). &quot;A
        confirmar&quot;, &quot;Transferido&quot; y &quot;Hacer seguimiento&quot; los prende el bot solo, pero siempre
        se pueden prender/apagar a mano desde el detalle de la conversación.
      </p>

      <ul className="flex flex-col divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
        {STATES.map((s) => (
          <li key={s.label} className="flex flex-col gap-1 px-4 py-3 text-sm">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${s.dot}`} />
              <span className="font-medium">{s.label}</span>
              {!s.automatic ? <span className="text-xs text-foreground/40">(manual)</span> : null}
            </div>
            <p className="text-xs text-foreground/60">
              <span className="font-medium text-foreground/70">Se prende: </span>
              {s.trigger}
            </p>
            <p className="text-xs text-foreground/60">
              <span className="font-medium text-foreground/70">Se apaga: </span>
              {s.resolves}
            </p>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-3 rounded-xl border border-foreground/10 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Marcar &quot;Hacer seguimiento&quot; como vencido</span>
          <AutosaveStatus pending={pending} saved={saved} />
        </div>
        <p className="text-xs text-foreground/50">
          Días sin que el cliente responda desde que quedó &quot;Hacer seguimiento&quot; para resaltarla en naranja en
          el listado (no cambia cuándo entra al estado, solo cómo se destaca después).
        </p>
        <TextField
          id="followUpStaleDays"
          label="Días"
          type="number"
          inputMode="numeric"
          min={1}
          max={30}
          value={days}
          onChange={(e) => {
            setDays(e.target.value);
            debouncedSave(e.target.value);
          }}
          className="max-w-[8rem]"
        />
      </div>
    </div>
  );
}
