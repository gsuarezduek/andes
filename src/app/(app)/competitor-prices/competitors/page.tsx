import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { ADAPTER_KEYS } from "@/lib/competitor-prices/adapters";
import { Button, ButtonLink } from "@/components/ui/button";
import { TextField, SelectField } from "@/components/ui/fields";
import { CompetitorPricesNav } from "../nav";
import { createCompetitor } from "../actions";
import { CompetitorRow } from "./competitor-row";

export const metadata: Metadata = { title: "Competidores — Precios de la competencia — Andes" };

export default async function CompetitorsPage() {
  await requireAdmin();
  const competitors = await prisma.competitor.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Competidores</h1>
          <p className="text-sm text-foreground/60">
            Rentadoras a trackear. Desactivar saca al competidor de las corridas sin borrar su historial.
          </p>
        </div>
        <ButtonLink href="/competitor-prices" variant="secondary">
          ← Comparación
        </ButtonLink>
      </div>

      <CompetitorPricesNav active="/competitor-prices/competitors" />

      <ul className="flex flex-col divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
        {competitors.map((c) => (
          <CompetitorRow key={c.id} competitor={c} />
        ))}
        {competitors.length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-foreground/50">Todavía no hay competidores cargados.</li>
        ) : null}
      </ul>

      <section className="flex flex-col gap-3 rounded-xl border border-foreground/10 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">Agregar competidor</h2>
        <form action={createCompetitor} className="flex flex-col gap-3">
          <TextField id="name" label="Nombre" placeholder="Ej. Rentar Low Cost" required />
          <TextField id="url" label="Sitio web" type="url" placeholder="https://…" required />
          <SelectField id="adapterKey" label="Adaptador" hint="Qué módulo de código lo maneja (se agregan al implementar cada competidor real).">
            {ADAPTER_KEYS.map((key) => (
              <option key={key} value={key}>
                {key}
              </option>
            ))}
          </SelectField>
          <Button type="submit" className="self-start">
            Agregar
          </Button>
        </form>
      </section>
    </div>
  );
}
