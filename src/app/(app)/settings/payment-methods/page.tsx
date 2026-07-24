import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  createPaymentMethod,
  updatePaymentMethod,
  togglePaymentMethod,
  deletePaymentMethod,
  movePaymentMethod,
} from "./actions";

export const metadata: Metadata = { title: "Medios de pago — Andes" };

export default async function PaymentMethodsSettingsPage() {
  await requireAdmin();

  const items = await prisma.paymentMethod.findMany({ orderBy: { ordering: "asc" } });

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Medios de pago</h1>
          <p className="text-sm text-foreground/60">
            Se ofrecen al agregar un pago en la entrega. El % es un recargo (+) o descuento (−)
            sobre el importe de esa línea. La referencia (alias/CVU) es solo interna: se le
            muestra al empleado al elegir el medio, nunca sale en el acta.
          </p>
        </div>
        <ButtonLink href="/settings" variant="secondary">
          Volver
        </ButtonLink>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground/80">Nuevo medio de pago</h2>
        <form action={createPaymentMethod} className="flex flex-col gap-3 rounded-xl border border-foreground/10 p-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-foreground/80">Nombre</span>
              <input
                name="name"
                required
                placeholder="Ej. Tarjeta de crédito"
                className="h-11 rounded-lg border border-foreground/15 bg-transparent px-3 text-base outline-none focus:border-foreground/40"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-foreground/80">% (recargo/descuento)</span>
              <input
                name="adjustmentPercent"
                type="text"
                inputMode="decimal"
                placeholder="Ej. 10 o -5"
                className="h-11 rounded-lg border border-foreground/15 bg-transparent px-3 text-base outline-none focus:border-foreground/40"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-foreground/80">Referencia (alias/CVU)</span>
            <textarea
              name="reference"
              rows={2}
              placeholder="Ej. Alias: mdzrentacar.mp"
              className="rounded-lg border border-foreground/15 bg-transparent p-3 text-base outline-none focus:border-foreground/40"
            />
          </label>
          <div className="flex justify-end">
            <SubmitButton pendingLabel="Agregando…">Agregar</SubmitButton>
          </div>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground/80">{items.length} medios de pago</h2>
        <ul className="flex flex-col gap-3">
          {items.map((it, i) => (
            <li key={it.id} className="flex flex-col gap-2 rounded-xl border border-foreground/10 p-3">
              <div className="flex items-center gap-2">
                <div className="flex flex-col">
                  <form action={movePaymentMethod.bind(null, it.id, "up")}>
                    <button disabled={i === 0} className="px-1 text-xs text-foreground/50 disabled:opacity-30" aria-label="Subir">▲</button>
                  </form>
                  <form action={movePaymentMethod.bind(null, it.id, "down")}>
                    <button disabled={i === items.length - 1} className="px-1 text-xs text-foreground/50 disabled:opacity-30" aria-label="Bajar">▼</button>
                  </form>
                </div>
                <span className="flex-1 text-sm font-medium">{it.name}</span>
                {!it.active && <Badge tone="neutral">Inactivo</Badge>}
                <form action={togglePaymentMethod.bind(null, it.id)}>
                  <button className="rounded-md px-2 py-1 text-xs font-medium text-foreground/60 hover:bg-foreground/5">
                    {it.active ? "Desactivar" : "Activar"}
                  </button>
                </form>
                <form action={deletePaymentMethod.bind(null, it.id)}>
                  <button className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-500/10">
                    Borrar
                  </button>
                </form>
              </div>
              <form action={updatePaymentMethod.bind(null, it.id)} className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    name="name"
                    defaultValue={it.name}
                    required
                    className="h-10 rounded-lg border border-foreground/15 bg-transparent px-3 text-sm outline-none focus:border-foreground/40"
                  />
                  <input
                    name="adjustmentPercent"
                    type="text"
                    inputMode="decimal"
                    defaultValue={it.adjustmentPercent?.toString() ?? ""}
                    placeholder="% recargo/descuento"
                    className="h-10 rounded-lg border border-foreground/15 bg-transparent px-3 text-sm outline-none focus:border-foreground/40"
                  />
                </div>
                <textarea
                  name="reference"
                  rows={2}
                  defaultValue={it.reference ?? ""}
                  placeholder="Referencia (alias/CVU) — interna"
                  className="rounded-lg border border-foreground/15 bg-transparent p-2 text-sm outline-none focus:border-foreground/40"
                />
                <div className="flex justify-end">
                  <SubmitButton pendingLabel="Guardando…">Guardar</SubmitButton>
                </div>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
