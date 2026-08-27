import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { Button, ButtonLink } from "@/components/ui/button";
import { TextField } from "@/components/ui/fields";
import { CompetitorPricesNav } from "../nav";
import { createCompetitorCategory, confirmCategoryMapping } from "../actions";

export const metadata: Metadata = { title: "Categorías — Precios de la competencia — Andes" };

export default async function CompetitorCategoriesPage() {
  await requireAdmin();

  const [categories, pendingMappings] = await Promise.all([
    prisma.competitorCategory.findMany({ orderBy: { ordering: "asc" } }),
    prisma.competitorCategoryMapping.findMany({
      where: { categoryId: null },
      include: { competitor: { select: { name: true } }, suggestedCategory: { select: { label: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Categorías</h1>
          <p className="text-sm text-foreground/60">
            Categorías internas para comparar contra la competencia, y la cola de rótulos nuevos sin confirmar.
          </p>
        </div>
        <ButtonLink href="/competitor-prices" variant="secondary">
          ← Comparación
        </ButtonLink>
      </div>

      <CompetitorPricesNav active="/competitor-prices/categories" />

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
          Rótulos sin confirmar ({pendingMappings.length})
        </h2>
        <p className="text-xs text-foreground/50">
          No cuentan para la tabla comparativa hasta confirmarse. La sugerencia (si hay) la propuso el LLM — nunca se
          usa sola.
        </p>
        {pendingMappings.length === 0 ? (
          <p className="rounded-lg border border-foreground/10 px-4 py-3 text-sm text-foreground/50">
            No hay rótulos pendientes de revisión.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
            {pendingMappings.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{m.rawLabel}</p>
                  <p className="text-xs text-foreground/50">
                    {m.competitor.name}
                    {m.suggestedCategory ? ` · sugerido: ${m.suggestedCategory.label}` : ""}
                  </p>
                </div>
                <form action={confirmCategoryMapping.bind(null, m.id)} className="flex items-center gap-2">
                  <select
                    name="categoryId"
                    defaultValue={m.suggestedCategoryId ?? ""}
                    required
                    className="h-10 rounded-lg border border-foreground/15 bg-transparent px-2 text-sm outline-none focus:border-foreground/40"
                  >
                    <option value="" disabled>
                      Elegir categoría…
                    </option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" variant="secondary">
                    Confirmar
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">Categorías</h2>
        <ul className="flex flex-col divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
          {categories.map((c) => (
            <li key={c.id} className="px-4 py-3 text-sm font-medium">
              {c.label}
            </li>
          ))}
          {categories.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-foreground/50">Todavía no hay categorías cargadas.</li>
          ) : null}
        </ul>

        <form action={createCompetitorCategory} className="flex items-end gap-2">
          <div className="flex-1">
            <TextField id="label" label="Nueva categoría" placeholder="Ej. Intermedio" required />
          </div>
          <Button type="submit">Agregar</Button>
        </form>
      </section>
    </div>
  );
}
