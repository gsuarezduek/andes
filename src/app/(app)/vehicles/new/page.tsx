import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { VehicleForm } from "../vehicle-form";
import { createVehicle } from "../actions";

export const metadata: Metadata = { title: "Nuevo vehículo — Andes" };

export default async function NewVehiclePage() {
  await requireAdmin();
  const competitorCategories = await prisma.competitorCategory.findMany({
    orderBy: { ordering: "asc" },
    select: { id: true, label: true },
  });

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <h1 className="text-2xl font-bold tracking-tight">Nuevo vehículo</h1>
      <VehicleForm action={createVehicle} cancelHref="/vehicles" isAdmin competitorCategories={competitorCategories} />
    </div>
  );
}
