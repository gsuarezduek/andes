import type { Metadata } from "next";
import type { SyncResult } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { env } from "@/lib/env";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatDateTime } from "@/lib/datetime";
import { triggerSync, triggerFleetSeed } from "./actions";

export const metadata: Metadata = { title: "Sincronización — Andes" };

const resultTone: Record<SyncResult, "green" | "amber" | "red"> = {
  success: "green",
  partial: "amber",
  error: "red",
};

const resultLabel: Record<SyncResult, string> = {
  success: "OK",
  partial: "Parcial",
  error: "Error",
};

export default async function SyncPage() {
  await requireUser();

  const logs = await prisma.syncLog.findMany({ orderBy: { createdAt: "desc" }, take: 30 });

  const transport = env.hasWpRest
    ? { label: "REST (mu-plugin)", ok: true }
    : env.hasWpMysql
      ? { label: "MySQL directo (pruebas)", ok: true }
      : { label: "Sin configurar", ok: false };

  const rentalCount = await prisma.rental.count({ where: { origin: "vikrentcar" } });
  const unassigned = await prisma.rental.count({
    where: { origin: "vikrentcar", status: "reserved", vehicleId: null },
  });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Sincronización con VikRentCar</h1>
        <p className="text-sm text-foreground/60">
          Importa las reservas confirmadas del WordPress. La app funciona aunque el sitio esté caído.
        </p>
      </div>

      <div className="divide-y divide-foreground/10 rounded-xl border border-foreground/10 px-4">
        <div className="flex items-center justify-between py-3 text-sm">
          <span className="text-foreground/60">Transporte</span>
          <span className="flex items-center gap-2 font-medium">
            {transport.label}
            <Badge tone={transport.ok ? "green" : "red"}>{transport.ok ? "activo" : "falta"}</Badge>
          </span>
        </div>
        <div className="flex items-center justify-between py-3 text-sm">
          <span className="text-foreground/60">Reservas de VikRentCar</span>
          <span className="font-medium">{rentalCount}</span>
        </div>
        <div className="flex items-center justify-between py-3 text-sm">
          <span className="text-foreground/60">Sin vehículo asignado</span>
          <span className="font-medium">{unassigned}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <form action={triggerSync}>
          <SubmitButton pendingLabel="Sincronizando…">Sincronizar ahora</SubmitButton>
        </form>
        <form action={triggerFleetSeed}>
          <SubmitButton pendingLabel="Importando flota…" variant="secondary">
            Importar flota desde VikRentCar
          </SubmitButton>
        </form>
      </div>
      <p className="-mt-4 text-xs text-foreground/50">
        &quot;Importar flota&quot; crea las unidades que falten con patente provisoria; nunca pisa un
        vehículo ya cargado. El cron de Railway llama a <code>POST /api/sync</code> cada 5–10 min.
      </p>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground/60">
          Últimas corridas
        </h2>
        {logs.length === 0 ? (
          <p className="rounded-lg border border-foreground/10 px-4 py-3 text-sm text-foreground/50">
            Todavía no se corrió ninguna sincronización.
          </p>
        ) : (
          <div className="divide-y divide-foreground/10 overflow-hidden rounded-xl border border-foreground/10">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge tone={resultTone[log.result]}>{resultLabel[log.result]}</Badge>
                    <span className="text-xs text-foreground/50">{formatDateTime(log.createdAt)}</span>
                  </div>
                  {log.message ? (
                    <p className="mt-1 whitespace-pre-wrap text-xs text-foreground/60">{log.message}</p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right text-xs text-foreground/50">
                  <p>+{log.imported} / ~{log.updated}</p>
                  {log.errors > 0 ? <p className="text-red-600">{log.errors} err</p> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
