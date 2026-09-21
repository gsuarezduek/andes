import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { ButtonLink } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { SectionHeading } from "@/components/ui/section-heading";
import { createExpenseCategory } from "./actions";
import { ExpenseCategoryRow } from "./expense-category-row";

export const metadata: Metadata = { title: "Categorías de gasto — Andes" };

export default async function ExpenseCategoriesSettingsPage() {
  await requireAdmin();

  const items = await prisma.cashMovementCategory.findMany({ orderBy: { ordering: "asc" } });

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Categorías de gasto</h1>
          <p className="text-sm text-foreground/60">
            Se ofrecen, de forma opcional, al cargar o editar un Egreso en Caja. Un Ingreso no se categoriza.
          </p>
        </div>
        <ButtonLink href="/settings" variant="secondary">
          Volver
        </ButtonLink>
      </div>

      <section className="flex flex-col gap-3">
        <SectionHeading>Nueva categoría</SectionHeading>
        <form action={createExpenseCategory} className="flex gap-2">
          <input
            name="name"
            required
            placeholder="Ej. Combustible"
            className="h-11 flex-1 rounded-lg border border-foreground/15 bg-transparent px-3 text-base outline-none focus:border-foreground/40"
          />
          <SubmitButton pendingLabel="Agregando…">Agregar</SubmitButton>
        </form>
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading>{items.length} categorías</SectionHeading>
        {items.length === 0 ? (
          <p className="rounded-lg border border-foreground/10 px-3 py-2 text-sm text-foreground/50">
            Todavía no hay categorías cargadas.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
            {items.map((it, i) => (
              <ExpenseCategoryRow key={it.id} item={it} isFirst={i === 0} isLast={i === items.length - 1} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
