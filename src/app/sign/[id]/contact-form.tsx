"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TextField, FormError } from "@/components/ui/fields";
import { Button } from "@/components/ui/button";
import type { ClientFieldKey } from "@/lib/remote-signature";

const FIELD_LABELS: Record<ClientFieldKey, string> = {
  name: "Nombre y apellido",
  email: "Email",
  phone: "Teléfono",
  docNumber: "DNI / Pasaporte",
  address: "Domicilio en Mendoza",
};

/**
 * Formulario público (sin sesión) para que el cliente complete él mismo los
 * datos que falten, mientras sigue en vivo la entrega por /sign/[id]. Solo
 * muestra los campos de `missing` — nunca uno que el staff ya haya cargado.
 * Al guardar, `router.refresh()` vuelve a traer el estado real del servidor:
 * si quedó algo sin completar (el cliente no quiso dar su domicilio, por
 * ejemplo), el formulario reaparece solo con eso.
 */
export function ClientContactForm({ id, missing }: { id: string; missing: ClientFieldKey[] }) {
  const router = useRouter();
  const [values, setValues] = useState<Partial<Record<ClientFieldKey, string>>>({});
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string>();

  async function submit() {
    setError(undefined);
    setState("sending");
    try {
      const res = await fetch(`/api/sign/${id}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "error");
      }
      setState("done");
      router.refresh();
    } catch {
      setState("idle");
      setError("No se pudo guardar. Reintentá.");
    }
  }

  if (state === "done") {
    return (
      <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-center text-sm font-medium text-emerald-700 dark:text-emerald-400">
        ¡Gracias! Guardamos tus datos.
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-foreground/15 p-4">
      <div>
        <p className="text-sm font-semibold text-foreground/80">Completá tus datos</p>
        <p className="text-xs text-foreground/60">Nos faltan algunos datos tuyos para el contrato.</p>
      </div>
      {missing.map((key) => (
        <TextField
          key={key}
          id={`contact-${key}`}
          label={FIELD_LABELS[key]}
          type={key === "email" ? "email" : "text"}
          value={values[key] ?? ""}
          onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
        />
      ))}
      <FormError>{error}</FormError>
      <Button type="button" onClick={submit} disabled={state === "sending"}>
        {state === "sending" ? "Guardando…" : "Guardar mis datos"}
      </Button>
    </section>
  );
}
