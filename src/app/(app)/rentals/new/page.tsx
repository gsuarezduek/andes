import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { RentalForm } from "../rental-form";
import { createRental } from "../actions";

export const metadata: Metadata = { title: "Nuevo alquiler — Andes" };

export default async function NewRentalPage() {
  await requireUser();

  const vehicles = await prisma.vehicle.findMany({
    where: { archivedAt: null },
    orderBy: [{ brand: "asc" }, { model: "asc" }],
    select: { id: true, plate: true, brand: true, model: true },
  });

  const options = vehicles.map((v) => ({
    id: v.id,
    label: `${v.plate} · ${v.brand} ${v.model}`,
  }));

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <h1 className="text-2xl font-bold tracking-tight">Nuevo alquiler manual</h1>
      <RentalForm action={createRental} vehicles={options} />
    </div>
  );
}
