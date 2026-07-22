import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { formatDateTime } from "@/lib/datetime";
import { InspectionWizard } from "@/components/inspection/inspection-wizard";
import type { ContractPricing } from "@/lib/contract";
import { saveReturn } from "./actions";
import { createRemoteSignature } from "../remote-sign-actions";

export const metadata: Metadata = { title: "Devolución — Andes" };

export default async function ReturnPage({
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
      inspections: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!rental) notFound();

  const handover = rental.inspections.find((i) => i.type === "handover");
  const hasReturn = rental.inspections.some((i) => i.type === "return_");

  // Solo se puede devolver un alquiler activo, con entrega y sin devolución.
  if (rental.status !== "active" || !handover || hasReturn || !rental.vehicle) {
    redirect(`/rentals/${rental.id}`);
  }

  const [checklistItems, existingDamages] = await Promise.all([
    prisma.checklistItem.findMany({
      where: { active: true },
      orderBy: { ordering: "asc" },
      select: { id: true, label: true },
    }),
    prisma.damage.findMany({
      where: { vehicleId: rental.vehicle.id, repaired: false, view: "top" },
      select: { posX: true, posY: true, description: true },
    }),
  ]);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5">
      <h1 className="text-2xl font-bold tracking-tight">Devolución</h1>
      <InspectionWizard
        mode="return"
        save={saveReturn}
        rentalId={rental.id}
        client={{
          name: rental.clientName,
          email: rental.clientEmail,
          phone: rental.clientPhone,
          dni: rental.clientDocNumber,
          address: rental.clientAddress,
        }}
        datesLabel={`${formatDateTime(rental.startAt)} → ${formatDateTime(rental.endAt)}`}
        vehicle={{
          id: rental.vehicle.id,
          label: `${rental.vehicle.brand} ${rental.vehicle.model} · ${rental.vehicle.plate}`,
          currentKm: rental.vehicle.currentKm,
        }}
        vehicleOptions={[]}
        checklistItems={checklistItems}
        existingDamages={existingDamages}
        maxFuel={rental.vehicle.fuelLevels}
        language={rental.language}
        createRemoteSignature={createRemoteSignature}
        returnContext={{
          handoverKm: handover.km,
          handoverFuel: handover.fuelLevel,
          pricing: (rental.pricing as ContractPricing | null) ?? undefined,
        }}
      />
    </div>
  );
}
