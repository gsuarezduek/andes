import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { ButtonLink } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { formatArs } from "@/lib/contract";
import { vehicleLabelWithPlate } from "@/lib/vehicle-ui";
import { OrderManager, type OrderRow } from "./order-manager";

export const metadata: Metadata = { title: "Calendario — Andes" };

export default async function CalendarSettingsPage() {
  await requireAdmin();

  const vehicles = await prisma.vehicle.findMany({
    where: { archivedAt: null },
    orderBy: [{ sortOrder: "asc" }, { brand: "asc" }, { model: "asc" }, { plate: "asc" }],
    select: { id: true, plate: true, name: true, brand: true, model: true, dailyRate: true },
  });

  const rows: OrderRow[] = vehicles.map((v) => ({
    id: v.id,
    label: vehicleLabelWithPlate(v),
    rateLabel: v.dailyRate != null ? `${formatArs(Number(v.dailyRate))} / día` : "Sin tarifa",
  }));

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Calendario</h1>
          <p className="text-sm text-foreground/60">Ajustes de la vista de calendario.</p>
        </div>
        <ButtonLink href="/settings" variant="secondary">
          Volver
        </ButtonLink>
      </div>

      <section className="flex flex-col gap-3">
        <SectionHeading description="Definí en qué orden aparecen los autos en el calendario (de arriba hacia abajo). Se suele ordenar del más caro al más económico; la tarifa se muestra como referencia.">
          Orden de los autos
        </SectionHeading>
        <OrderManager initial={rows} />
      </section>
    </div>
  );
}
