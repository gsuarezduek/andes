import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { ButtonLink } from "@/components/ui/button";
import { PrintButton } from "@/components/print-button";
import { QrCard } from "@/components/vehicle/qr-card";
import { vehicleDeepLink, qrSvg } from "@/lib/qr";

export const metadata: Metadata = { title: "QR de la flota — Andes" };

/** Hoja imprimible con el QR de cada vehículo de la flota. */
export default async function FleetQrPage() {
  await requireAdmin();

  const vehicles = await prisma.vehicle.findMany({ orderBy: [{ brand: "asc" }, { model: "asc" }] });
  const cards = await Promise.all(
    vehicles.map(async (v) => ({
      id: v.id,
      title: `${v.brand} ${v.model}`,
      subtitle: v.plate,
      svg: await qrSvg(vehicleDeepLink(v.id)),
    })),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="no-print flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">QR de la flota</h1>
          <p className="text-sm text-foreground/60">{vehicles.length} vehículos · imprimí y pegá uno en cada auto.</p>
        </div>
        <div className="flex gap-2">
          <ButtonLink href="/vehicles" variant="secondary">Volver</ButtonLink>
          <PrintButton>Imprimir todo</PrintButton>
        </div>
      </div>

      {cards.length === 0 ? (
        <p className="rounded-xl border border-foreground/10 px-4 py-3 text-sm text-foreground/50">
          No hay vehículos cargados.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {cards.map((c) => (
            <QrCard key={c.id} svg={c.svg} title={c.title} subtitle={c.subtitle} />
          ))}
        </div>
      )}
    </div>
  );
}
