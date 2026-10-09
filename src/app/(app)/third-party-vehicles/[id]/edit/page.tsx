import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth-helpers";
import { getThirdPartyVehicleDetail } from "@/lib/third-party-vehicles/queries";
import { ThirdPartyVehicleForm } from "@/components/third-party-vehicles/vehicle-form";
import { updateThirdPartyVehicle } from "../../actions";

export const metadata: Metadata = { title: "Editar vehículo de tercero — Andes" };

export default async function EditThirdPartyVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const detail = await getThirdPartyVehicleDetail(id);
  if (!detail) notFound();
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <h1 className="text-2xl font-bold tracking-tight">Editar vehículo de tercero</h1>
      <ThirdPartyVehicleForm action={updateThirdPartyVehicle.bind(null, id)} vehicle={detail.vehicle} cancelHref={`/third-party-vehicles/${id}`} />
    </div>
  );
}
