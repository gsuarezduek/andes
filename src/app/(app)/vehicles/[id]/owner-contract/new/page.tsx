import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { formatDate, formatDateTimeInput } from "@/lib/datetime";
import { displayName } from "@/lib/user-display";
import { currentOwnerContract } from "@/lib/owner-contract";
import { getCurrentOwnerContractText } from "@/lib/owner-contract-server";
import { OwnerContractWizard } from "@/components/owner-contract/owner-contract-wizard";

export const metadata: Metadata = { title: "Contrato de cesión — Andes" };

export default async function NewOwnerContractPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();

  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    include: { ownerContracts: { select: { startsAt: true, endsAt: true, voidedAt: true } } },
  });
  if (!vehicle) notFound();
  if (vehicle.ownership !== "third_party") redirect(`/vehicles/${id}`);

  // Server component: se evalúa una vez por request, leer el reloj acá es correcto.
  // eslint-disable-next-line react-hooks/purity
  const now = new Date(Date.now());
  const current = currentOwnerContract(vehicle.ownerContracts, now);
  const [startDate, startTime] = formatDateTimeInput(now).split("T");

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Contrato de cesión</h1>
        <p className="text-sm text-foreground/60">
          {vehicle.brand} {vehicle.model} · {vehicle.plate}
        </p>
      </div>
      {current && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          Este auto ya tiene un contrato vigente hasta {formatDate(current.endsAt)}. Si seguís, los dos van a quedar vigentes
          hasta que venza o des de baja el anterior.
        </p>
      )}
      <OwnerContractWizard
        vehicle={{
          id: vehicle.id,
          brand: vehicle.brand,
          model: vehicle.model,
          year: vehicle.year,
          plate: vehicle.plate,
          fuelLevels: vehicle.fuelLevels,
        }}
        initial={{
          ownerName: vehicle.ownerName ?? "",
          ownerDocNumber: vehicle.ownerDocNumber ?? "",
          ownerAddress: vehicle.ownerAddress ?? "",
          ownerEmail: vehicle.ownerEmail ?? "",
          ownerPhone: vehicle.ownerPhone ?? "",
          place: "Mendoza",
          startDate,
          startTime,
          endDate: "",
          endTime: startTime,
          commercialTerms: "",
          km: String(vehicle.currentKm),
          fuelLevel: vehicle.fuelLevels,
          responses: {},
          observations: "",
          companySignerName: displayName(user),
        }}
        text={await getCurrentOwnerContractText()}
      />
    </div>
  );
}
