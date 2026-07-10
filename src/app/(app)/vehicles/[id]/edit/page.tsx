import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { VehicleForm } from "../../vehicle-form";
import { updateVehicle } from "../../actions";

export const metadata: Metadata = { title: "Editar vehículo — Andes" };

export default async function EditVehiclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAdmin();

  const vehicle = await prisma.vehicle.findUnique({ where: { id } });
  if (!vehicle) notFound();

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <h1 className="text-2xl font-bold tracking-tight">Editar vehículo</h1>
      <VehicleForm
        action={updateVehicle.bind(null, id)}
        vehicle={vehicle}
        cancelHref={`/vehicles/${id}`}
      />
    </div>
  );
}
