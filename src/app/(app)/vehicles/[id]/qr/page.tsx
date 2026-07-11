import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { ButtonLink } from "@/components/ui/button";
import { PrintButton } from "@/components/print-button";
import { QrCard } from "@/components/vehicle/qr-card";
import { vehicleDeepLink, qrSvg } from "@/lib/qr";

export const metadata: Metadata = { title: "QR del vehículo — Andes" };

export default async function VehicleQrPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAdmin();

  const vehicle = await prisma.vehicle.findUnique({ where: { id } });
  if (!vehicle) notFound();

  const svg = await qrSvg(vehicleDeepLink(vehicle.id));

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <div className="no-print flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight">QR para pegar en el auto</h1>
        <div className="flex gap-2">
          <ButtonLink href={`/vehicles/${vehicle.id}`} variant="secondary">Volver</ButtonLink>
          <PrintButton />
        </div>
      </div>

      <QrCard
        svg={svg}
        title={`${vehicle.brand} ${vehicle.model}`}
        subtitle={vehicle.plate}
      />

      <p className="no-print text-xs text-foreground/50">
        Imprimí y pegá el QR en un lugar visible del vehículo (guantera, parabrisas). Al escanearlo, el
        empleado va directo a iniciar la entrega o devolución de ese auto.
      </p>
    </div>
  );
}
