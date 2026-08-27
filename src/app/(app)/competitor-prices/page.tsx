import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-helpers";
import { getComparisonData } from "@/lib/competitor-prices/comparison";
import { formatDateTime } from "@/lib/datetime";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { CompetitorPricesNav } from "./nav";
import { ComparisonTable } from "./comparison-table";
import { triggerCompetitorPriceCheck } from "./actions";

export const metadata: Metadata = { title: "Precios de la competencia — Andes" };

const resultTone = { success: "emerald", partial: "amber", error: "red" } as const;
const resultLabel = { success: "OK", partial: "Parcial", error: "Error" } as const;

export default async function CompetitorPricesPage({
  searchParams,
}: {
  searchParams: Promise<{ offset?: string }>;
}) {
  await requireAdmin();
  const { offset } = await searchParams;
  const offsetRaw = offset != null ? Number(offset) : undefined;
  const data = await getComparisonData(Number.isFinite(offsetRaw) ? offsetRaw : undefined);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Precios de la competencia</h1>
        <p className="text-sm text-foreground/60">
          Comparación rápida contra otras rentadoras de Mendoza, por categoría de vehículo.
        </p>
      </div>

      <CompetitorPricesNav active="/competitor-prices" />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-foreground/10 px-4 py-3">
        <div className="text-sm">
          <span className="text-foreground/60">Última actualización: </span>
          {data.lastRun ? (
            <span className="inline-flex items-center gap-2 font-medium">
              {formatDateTime(data.lastRun.finishedAt)}
              {data.lastRun.result ? (
                <Badge tone={resultTone[data.lastRun.result]}>{resultLabel[data.lastRun.result]}</Badge>
              ) : null}
            </span>
          ) : (
            <span className="font-medium">nunca</span>
          )}
        </div>
        <form action={triggerCompetitorPriceCheck}>
          <SubmitButton pendingLabel="Actualizando…">Actualizar precios ahora</SubmitButton>
        </form>
      </div>

      {data.offsetsAvailable.length > 1 ? (
        <div className="flex flex-wrap items-center gap-2">
          {data.offsetsAvailable.map((o) => (
            <ButtonLink
              key={o}
              href={`/competitor-prices?offset=${o}`}
              variant={o === data.offsetDays ? "primary" : "secondary"}
            >
              {o === 0 ? "Hoy" : `+${o} días`}
            </ButtonLink>
          ))}
        </div>
      ) : null}

      <ComparisonTable data={data} />

      <p className="text-xs text-foreground/40">
        Click en un precio para ver la fecha de consulta, las fechas del alquiler y el link a la
        fuente. Los rótulos de auto sin categoría confirmada todavía no cuentan acá — revisalos en{" "}
        <span className="font-medium">Categorías</span>.
      </p>
    </div>
  );
}
