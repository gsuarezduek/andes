import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { VehicleForm } from "../../vehicles/vehicle-form";
import { createVehicle } from "../../vehicles/actions";

export const metadata: Metadata = { title: "Nuevo vehículo de tercero — Andes" };

export default async function NewThirdPartyVehiclePage() {
  await requireUser();
  const competitorCategories = await prisma.competitorCategory.findMany({
    orderBy: { ordering: "asc" },
    select: { id: true, label: true },
  });

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <h1 className="text-2xl font-bold tracking-tight">Nuevo vehículo de tercero</h1>
      <VehicleForm
        action={createVehicle}
        cancelHref="/third-party-vehicles"
        defaultOwnership="third_party"
        competitorCategories={competitorCategories}
      />
    </div>
  );
}
