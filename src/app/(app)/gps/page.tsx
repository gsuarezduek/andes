import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { SectionHeading } from "@/components/ui/section-heading";
import { vehicleLabelWithPlate } from "@/lib/vehicle-ui";
import { GpsDeviceForm } from "./gps-device-form";
import { GpsDeviceRow } from "./gps-device-row";

export const metadata: Metadata = { title: "GPS — Andes" };

export default async function GpsPage() {
  const user = await requireUser();
  const isAdmin = user.role === "admin";

  const [devices, vehicles] = await Promise.all([
    prisma.gpsDevice.findMany({ orderBy: { identifier: "asc" } }),
    prisma.vehicle.findMany({
      where: { archivedAt: null },
      orderBy: [{ brand: "asc" }, { model: "asc" }],
      select: { id: true, plate: true, name: true, brand: true, model: true },
    }),
  ]);

  const vehicleOptions = vehicles.map((v) => ({ id: v.id, label: vehicleLabelWithPlate(v) }));

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">GPS</h1>
        <p className="text-sm text-foreground/60">
          Qué auto tiene instalado cada dispositivo de rastreo. Solo asignación actual — sin mapa
          ni ubicación en vivo.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <SectionHeading>Nuevo dispositivo</SectionHeading>
        <GpsDeviceForm />
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeading>{devices.length} dispositivos</SectionHeading>
        {devices.length > 0 ? (
          <ul className="divide-y divide-foreground/10 rounded-xl border border-foreground/10">
            {devices.map((d) => (
              <GpsDeviceRow
                key={d.id}
                device={{ id: d.id, identifier: d.identifier, vehicleId: d.vehicleId }}
                vehicles={vehicleOptions}
                isAdmin={isAdmin}
              />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-foreground/50">Todavía no hay dispositivos cargados.</p>
        )}
      </section>
    </div>
  );
}
