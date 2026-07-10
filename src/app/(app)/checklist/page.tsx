import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  createChecklistItem,
  toggleChecklistItem,
  deleteChecklistItem,
  moveChecklistItem,
} from "./actions";

export const metadata: Metadata = { title: "Checklist — Andes" };

export default async function ChecklistPage() {
  await requireAdmin();
  const items = await prisma.checklistItem.findMany({ orderBy: { ordering: "asc" } });

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Checklist</h1>
        <p className="text-sm text-foreground/60">
          Ítems de verificación de la entrega/devolución. {items.filter((i) => i.active).length} activos.
        </p>
      </div>

      <form action={createChecklistItem} className="flex gap-2">
        <input
          name="label"
          required
          placeholder="Nuevo ítem…"
          className="h-11 flex-1 rounded-lg border border-foreground/15 bg-transparent px-3 text-base outline-none focus:border-foreground/40"
        />
        <SubmitButton pendingLabel="Agregando…">Agregar</SubmitButton>
      </form>

      <ul className="flex flex-col divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
        {items.map((it, i) => (
          <li key={it.id} className="flex items-center gap-2 px-3 py-2">
            <div className="flex flex-col">
              <form action={moveChecklistItem.bind(null, it.id, "up")}>
                <button disabled={i === 0} className="px-1 text-xs text-foreground/50 disabled:opacity-30" aria-label="Subir">▲</button>
              </form>
              <form action={moveChecklistItem.bind(null, it.id, "down")}>
                <button disabled={i === items.length - 1} className="px-1 text-xs text-foreground/50 disabled:opacity-30" aria-label="Bajar">▼</button>
              </form>
            </div>
            <span className={`flex-1 text-sm ${it.active ? "" : "text-foreground/40 line-through"}`}>
              {it.label}
            </span>
            {!it.active && <Badge tone="neutral">Inactivo</Badge>}
            <form action={toggleChecklistItem.bind(null, it.id)}>
              <button className="rounded-md px-2 py-1 text-xs font-medium text-foreground/60 hover:bg-foreground/5">
                {it.active ? "Desactivar" : "Activar"}
              </button>
            </form>
            <form action={deleteChecklistItem.bind(null, it.id)}>
              <button className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-500/10">
                Borrar
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
