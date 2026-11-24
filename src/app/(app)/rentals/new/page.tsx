import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { vehicleLabelWithPlate } from "@/lib/vehicle-ui";
import { RentalForm } from "../rental-form";
import { createRental } from "../actions/create";
import { getBookingPlaceOptions } from "@/lib/booking-options";

export const metadata: Metadata = { title: "Nuevo alquiler — Andes" };

export default async function NewRentalPage() {
  await requireUser();

  const [vehicles, placeOptions] = await Promise.all([
    prisma.vehicle.findMany({
      where: { archivedAt: null },
      orderBy: [{ brand: "asc" }, { model: "asc" }],
      select: { id: true, plate: true, name: true, brand: true, model: true, ownership: true },
    }),
    getBookingPlaceOptions(),
  ]);

  const options = vehicles.map((v) => ({
    id: v.id,
    label: vehicleLabelWithPlate(v) + (v.ownership === "third_party" ? " (Tercero)" : ""),
    thirdParty: v.ownership === "third_party",
  }));

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <h1 className="text-2xl font-bold tracking-tight">Nuevo alquiler manual</h1>
      <RentalForm action={createRental} vehicles={options} placeOptions={placeOptions} />
    </div>
  );
}
