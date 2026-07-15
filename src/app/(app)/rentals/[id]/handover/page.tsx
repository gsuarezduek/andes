import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { formatDateTime, formatDateInput } from "@/lib/datetime";
import { InspectionWizard } from "@/components/inspection/inspection-wizard";
import { saveHandover } from "./actions";
import { createRemoteSignature } from "../remote-sign-actions";

export const metadata: Metadata = { title: "Entrega — Andes" };

export default async function HandoverPage({
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
      inspections: { where: { type: "handover" }, select: { id: true } },
    },
  });
  if (!rental) notFound();
  if (rental.status !== "reserved" || rental.inspections.length > 0) {
    // Ya entregado, activo, finalizado o cancelado: no se puede iniciar entrega.
    redirect(`/rentals/${rental.id}`);
  }

  const [checklistItems, vehicles, conditions] = await Promise.all([
    prisma.checklistItem.findMany({
      where: { active: true },
      orderBy: { ordering: "asc" },
      select: { id: true, label: true },
    }),
    prisma.vehicle.findMany({
      where: { archivedAt: null },
      orderBy: [{ brand: "asc" }, { model: "asc" }],
      select: { id: true, plate: true, brand: true, model: true },
    }),
    prisma.conditionSettings.findUnique({ where: { id: 1 } }),
  ]);

  // Condiciones precargadas: lo que ya cargó el empleado (rental.pricing) tiene
  // prioridad; se completa con el precio/días de la reserva (VikRentCar) y con
  // la plantilla global de Configuración. Todo editable en el wizard.
  const saved = (rental.pricing ?? {}) as Record<string, unknown>;
  const initialPricing: Record<string, string> = {};
  const preset = (key: string, value: number | null | undefined) => {
    if (saved[key] !== undefined && saved[key] !== null) initialPricing[key] = String(saved[key]);
    else if (value !== undefined && value !== null) initialPricing[key] = String(value);
  };
  preset("dailyRate", rental.bookingPricePerDay ? Number(rental.bookingPricePerDay) : null);
  preset("days", rental.bookingDays);
  // totpaid de VikRentCar = lo ya pagado/anticipado (p. ej. cobro online con
  // Andes Pay Stripe) → precarga la "Seña"; el saldo se autocalcula.
  preset("sena", rental.bookingPaid ? Number(rental.bookingPaid) : null);
  preset("insuranceAmount", conditions?.insuranceAmount ? Number(conditions.insuranceAmount) : null);
  preset("kmPerDay", conditions?.kmPerDay);
  preset("extraKmRate", conditions?.extraKmRate ? Number(conditions.extraKmRate) : null);
  preset("extraHourPercent", conditions?.extraHourPercent);
  // Accesorios (packs de km de VikRentCar) → importe.
  preset("accessoriesAmount", rental.bookingAccessoriesAmount ? Number(rental.bookingAccessoriesAmount) : null);
  // Franquicia: la reducida si la reserva trae mejora de seguro; si no, la estándar.
  preset(
    "deductible",
    rental.bookingInsuranceUpgrade
      ? conditions?.deductibleReduced
        ? Number(conditions.deductibleReduced)
        : null
      : conditions?.deductible
        ? Number(conditions.deductible)
        : null,
  );
  // Precargas de texto/flag (no numéricas): descripción de accesorios y mejora de
  // seguro. Solo si el empleado todavía no las cargó (saved gana).
  if (saved.accessoriesDesc === undefined && rental.bookingAccessories) {
    initialPricing.accessoriesDesc = rental.bookingAccessories;
  }
  if (saved.insuranceUpgrade === undefined && rental.bookingInsuranceUpgrade) {
    initialPricing.insuranceUpgrade = "true";
  }
  // Campos que solo puede haber cargado el empleado (no se precargan).
  for (const [k, v] of Object.entries(saved)) {
    if (initialPricing[k] === undefined && v !== null && v !== undefined) initialPricing[k] = String(v);
  }

  const existingDamages = rental.vehicleId
    ? await prisma.damage.findMany({
        where: { vehicleId: rental.vehicleId, repaired: false, view: "top" },
        select: { posX: true, posY: true, description: true },
      })
    : [];

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5">
      <h1 className="text-2xl font-bold tracking-tight">Entrega</h1>
      <InspectionWizard
        mode="handover"
        save={saveHandover}
        rentalId={rental.id}
        client={{
          name: rental.clientName,
          email: rental.clientEmail,
          phone: rental.clientPhone,
          dni: rental.clientDocNumber,
        }}
        licenseExpiry={rental.licenseExpiry ? formatDateInput(rental.licenseExpiry) : undefined}
        pricing={initialPricing}
        deductibleBase={conditions?.deductible ? Number(conditions.deductible) : undefined}
        deductibleReduced={conditions?.deductibleReduced ? Number(conditions.deductibleReduced) : undefined}
        bookingNote={rental.bookingNote ?? undefined}
        datesLabel={`${formatDateTime(rental.startAt)} → ${formatDateTime(rental.endAt)}`}
        vehicle={
          rental.vehicle
            ? {
                id: rental.vehicle.id,
                label: `${rental.vehicle.brand} ${rental.vehicle.model} · ${rental.vehicle.plate}`,
                currentKm: rental.vehicle.currentKm,
              }
            : null
        }
        maxFuel={rental.vehicle?.fuelLevels}
        vehicleOptions={vehicles.map((v) => ({
          id: v.id,
          label: `${v.plate} · ${v.brand} ${v.model}`,
        }))}
        checklistItems={checklistItems}
        existingDamages={existingDamages}
        language={rental.language}
        createRemoteSignature={createRemoteSignature}
      />
    </div>
  );
}
