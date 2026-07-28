import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { VehicleForm } from "../../vehicle-form";
import { updateVehicle } from "../../actions";

export const metadata: Metadata = { title: "Editar vehículo — Andes" };

export default async function EditVehiclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  // omit: dailyRate es un Decimal — un Server Component no puede pasárselo
  // tal cual a VehicleForm (Client Component); tampoco se usa en el form.
  const vehicle = await prisma.vehicle.findUnique({ where: { id }, omit: { dailyRate: true } });
  if (!vehicle) notFound();

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <h1 className="text-2xl font-bold tracking-tight">Editar vehículo</h1>
      <VehicleForm
        action={updateVehicle.bind(null, id)}
        vehicle={vehicle}
        cancelHref={`/vehicles/${id}`}
        isAdmin={user.role === "admin"}
      />
    </div>
  );
}
