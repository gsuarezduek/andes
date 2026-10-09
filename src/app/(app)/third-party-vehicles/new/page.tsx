import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-helpers";
import { ThirdPartyVehicleForm } from "@/components/third-party-vehicles/vehicle-form";
import { createThirdPartyVehicle } from "../actions";

export const metadata: Metadata = { title: "Nuevo vehículo de tercero — Andes" };

export default async function NewThirdPartyVehiclePage() {
  await requireAdmin();
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <h1 className="text-2xl font-bold tracking-tight">Nuevo vehículo de tercero</h1>
      <ThirdPartyVehicleForm action={createThirdPartyVehicle} cancelHref="/third-party-vehicles" />
    </div>
  );
}
