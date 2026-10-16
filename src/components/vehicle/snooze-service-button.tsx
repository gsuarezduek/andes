"use client";

import { useState, useTransition } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { TextField, FormError } from "@/components/ui/fields";
import { snoozeServiceAlert } from "@/app/(app)/vehicles/[id]/service-snooze-actions";
import { SNOOZE_DAY_PRESETS, SNOOZE_KM_PRESETS } from "@/lib/service-alerts";

type Mode = "km" | "days";

/**
 * Botón "Posponer" de la alerta de service (Home): pregunta en cuántos km o
 * cuántos días tiene que volver a aparecer.
 */
export function SnoozeServiceButton({ vehicleId, vehicleLabel }: { vehicleId: string; vehicleLabel: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("km");
  const [amount, setAmount] = useState<string>(String(SNOOZE_KM_PRESETS[1]));
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const presets = mode === "km" ? SNOOZE_KM_PRESETS : SNOOZE_DAY_PRESETS;
  const unit = mode === "km" ? "km" : "días";

  function switchMode(next: Mode) {
    setMode(next);
    setAmount(String(next === "km" ? SNOOZE_KM_PRESETS[1] : SNOOZE_DAY_PRESETS[0]));
    setError(undefined);
  }

  function submit() {
    const n = Number(amount);
    if (!Number.isInteger(n) || n <= 0) {
      setError("Ingresá una cantidad válida.");
      return;
    }
    startTransition(async () => {
      const res = await snoozeServiceAlert(vehicleId, { mode, amount: n });
      if (res.error) setError(res.error);
      else setOpen(false);
    });
  }

  const tab = (m: Mode, label: string) => (
    <button
      type="button"
      onClick={() => switchMode(m)}
      className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${mode === m ? "bg-foreground text-background" : "text-foreground/70 hover:bg-foreground/5"}`}
    >
      {label}
    </button>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(undefined);
          setOpen(true);
        }}
        className="shrink-0 rounded-md border border-foreground/15 px-2.5 py-1.5 text-xs font-medium text-foreground/70 hover:bg-foreground/5"
      >
        Posponer
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Posponer alerta de service">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-foreground/70">
            {vehicleLabel}: ¿cuándo querés que vuelva a aparecer la alerta?
          </p>
          <div className="flex gap-1 rounded-lg border border-foreground/15 p-1">
            {tab("km", "Por kilómetros")}
            {tab("days", "Por tiempo")}
          </div>
          <div className="flex flex-wrap gap-2">
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setAmount(String(p))}
                className={`rounded-full border px-3 py-1.5 text-sm ${amount === String(p) ? "border-foreground bg-foreground/10 font-semibold" : "border-foreground/15 text-foreground/70"}`}
              >
                {p.toLocaleString("es-AR")} {unit}
              </button>
            ))}
          </div>
          <TextField
            id="snooze-amount"
            label={mode === "km" ? "En cuántos km" : "En cuántos días"}
            type="number"
            inputMode="numeric"
            min={1}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            suffix={unit}
          />
          <FormError>{error}</FormError>
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={submit} disabled={pending}>
              {pending ? "Guardando…" : "Posponer"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
