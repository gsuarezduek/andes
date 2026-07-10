import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { formatDateTime, formatDateInput } from "@/lib/datetime";
import { HandoverWizard } from "./handover-wizard";

export const metadata: Metadata = { title: "Entrega — Andes" };

export default async function HandoverPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser();

  const rental = await prisma.rental.findUnique({
    where: { id },
    include: {
      vehicle: true,
      inspections: { where: { type: "handover" }, select: { id: true } },
    },
  });
  if (!rental) notFound();
  if (rental.status !== "reserved" || rental.inspections.length > 0) {
    // Ya entregado, activo, finalizado o cancelado: no se puede iniciar entrega.
    redirect(`/rentals/${rental.id}`);
  }

  const [checklistItems, vehicles] = await Promise.all([
    prisma.checklistItem.findMany({
      where: { active: true },
      orderBy: { ordering: "asc" },
      select: { id: true, label: true },
    }),
    prisma.vehicle.findMany({
      orderBy: [{ brand: "asc" }, { model: "asc" }],
      select: { id: true, plate: true, brand: true, model: true },
    }),
  ]);

  const existingDamages = rental.vehicleId
    ? await prisma.damage.findMany({
        where: { vehicleId: rental.vehicleId, repaired: false, view: "top" },
        select: { posX: true, posY: true },
      })
    : [];

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5">
      <h1 className="text-2xl font-bold tracking-tight">Entrega</h1>
      <HandoverWizard
        rentalId={rental.id}
        client={{
          name: rental.clientName,
          email: rental.clientEmail,
          phone: rental.clientPhone,
          dni: rental.clientDocNumber,
        }}
        licenseExpiry={rental.licenseExpiry ? formatDateInput(rental.licenseExpiry) : undefined}
        pricing={Object.fromEntries(
          Object.entries((rental.pricing ?? {}) as Record<string, unknown>).map(([k, v]) => [
            k,
            String(v),
          ]),
        )}
        datesLabel={`${formatDateTime(rental.startAt)} → ${formatDateTime(rental.endAt)}`}
        vehicle={
          rental.vehicle
            ? {
                id: rental.vehicle.id,
                label: `${rental.vehicle.brand} ${rental.vehicle.model} · ${rental.vehicle.plate}`,
                currentKm: rental.vehicle.currentKm,
              }
            : null
        }
        vehicleOptions={vehicles.map((v) => ({
          id: v.id,
          label: `${v.plate} · ${v.brand} ${v.model}`,
        }))}
        checklistItems={checklistItems}
        existingDamages={existingDamages}
        language={rental.language}
      />
    </div>
  );
}
