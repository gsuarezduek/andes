"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { mendozaWallTimeToUtc } from "@/lib/datetime";

const optNum = (nonneg = true) =>
  z.preprocess(
    (v) => (v === "" || v == null ? undefined : Number(v)),
    (nonneg ? z.number().nonnegative() : z.number()).optional(),
  );

const schema = z.object({
  type: z.enum(["service", "repair"]),
  date: z.string().min(1),
  km: optNum(),
  cost: optNum(),
  place: z.string().trim().optional(),
  description: z.string().trim().min(1, "Describí el service o arreglo"),
});

/**
 * Marca el vehículo de un alquiler como fuera de servicio y registra el
 * service/arreglo. Se usa cuando se cargó un alquiler solo para bloquear el auto
 * (no hay entrega real): en vez de hacer la entrega, se deja constancia del
 * arreglo (qué, costo, lugar) y el auto queda no disponible. El alquiler
 * placeholder se cancela.
 */
export async function markVehicleService(
  rentalId: string,
  vehicleId: string,
  formData: FormData,
): Promise<void> {
  await requireUser();

  const parsed = schema.safeParse({
    type: formData.get("type"),
    date: formData.get("date"),
    km: formData.get("km"),
    cost: formData.get("cost"),
    place: formData.get("place"),
    description: formData.get("description"),
  });
  if (!parsed.success) return;
  const data = parsed.data;

  const rental = await prisma.rental.findUnique({
    where: { id: rentalId },
    select: { vehicleId: true, status: true },
  });
  // Guardas: el alquiler debe estar sin iniciar (reservado) y apuntar a este auto.
  if (!rental || rental.vehicleId !== vehicleId || rental.status !== "reserved") return;

  await prisma.$transaction([
    prisma.maintenanceLog.create({
      data: {
        vehicleId,
        type: data.type,
        date: mendozaWallTimeToUtc(`${data.date}T12:00`),
        km: data.km ?? null,
        cost: data.cost ?? null,
        place: data.place || null,
        description: data.description,
      },
    }),
    prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        status: "out_of_service",
        ...(data.km != null ? { currentKm: data.km } : {}),
      },
    }),
    // El alquiler era solo para bloquear el auto: se cancela.
    prisma.rental.update({ where: { id: rentalId }, data: { status: "cancelled" } }),
  ]);

  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath(`/rentals/${rentalId}`);
  revalidatePath("/rentals");
  redirect(`/vehicles/${vehicleId}`);
}
