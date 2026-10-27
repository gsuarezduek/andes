"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { displayName } from "@/lib/user-display";
import { mendozaWallTimeToUtc } from "@/lib/datetime";
import { maintenanceTypeLabels } from "@/lib/labels";
import { parseDecimal } from "@/lib/number-input";
import { vehicleDisplayName } from "@/lib/vehicle-ui";
import { buildMaintenanceDebt } from "@/lib/maintenance-debt";

const optNum = z.preprocess(
  (v) => (v === "" || v == null ? undefined : Number(v)),
  z.number().nonnegative().optional(),
);
const optCost = z.preprocess(
  (v) => (v === "" || v == null ? undefined : parseDecimal(String(v))),
  z.number().nonnegative().optional(),
);

const openSchema = z.object({
  type: z.enum(["service", "repair"]),
  date: z.string().min(1),
  km: optNum,
  place: z.string().trim().optional(),
  description: z.string().trim().min(1, "Describí el service o arreglo"),
});

/**
 * "Marcar service/arreglo" desde el detalle de una reserva: para alquileres
 * cargados solo para bloquear el auto (reservado, sin entrega hecha), deja
 * registro del motivo y pone auto + reserva "en service". A diferencia de
 * antes, la reserva **no se cancela acá** — queda en `out_of_service` (color
 * propio en el Calendario/listado) hasta que se cierre con
 * `returnVehicleFromService`, desde la misma reserva. El costo no se pide
 * acá: muchas veces todavía no se sabe cuánto va a salir ni cuánto va a durar
 * — se carga al cerrar, cuando ya se sabe.
 */
export async function markVehicleService(
  rentalId: string,
  vehicleId: string,
  formData: FormData,
): Promise<void> {
  await requireUser();

  const parsed = openSchema.safeParse({
    type: formData.get("type"),
    date: formData.get("date"),
    km: formData.get("km"),
    place: formData.get("place"),
    description: formData.get("description"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }
  const data = parsed.data;

  const rental = await prisma.rental.findUnique({
    where: { id: rentalId },
    select: { vehicleId: true, status: true },
  });
  // Guardas: el alquiler debe estar sin iniciar (reservado) y apuntar a este auto.
  if (!rental || rental.vehicleId !== vehicleId || rental.status !== "reserved") {
    throw new Error("Esta reserva ya no se puede marcar a service (¿ya se hizo la entrega?).");
  }

  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { currentKm: true } });
  if (!vehicle) throw new Error("El vehículo no existe.");

  await prisma.$transaction([
    prisma.maintenanceLog.create({
      data: {
        vehicleId,
        rentalId,
        type: data.type,
        date: mendozaWallTimeToUtc(`${data.date}T12:00`),
        km: data.km ?? null,
        place: data.place || null,
        description: data.description,
      },
    }),
    prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        status: "out_of_service",
        ...(data.km != null && data.km > vehicle.currentKm ? { currentKm: data.km } : {}),
      },
    }),
    prisma.rental.update({ where: { id: rentalId }, data: { status: "out_of_service" } }),
  ]);

  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath(`/rentals/${rentalId}`);
  revalidatePath("/rentals");
  revalidatePath("/calendar");
  redirect(`/rentals/${rentalId}?service=opened`);
}

const closeSchema = z.object({
  date: z.string().min(1),
  km: optNum,
  cost: optCost,
  accountId: z.string().optional(),
  accountNote: z.string().trim().max(300).optional(),
});

/**
 * "Volver a poner en servicio": cierra el service/arreglo abierto por
 * `markVehicleService` en esta misma reserva. El auto vuelve a `available`
 * (con el service reprogramado si correspondía) y la reserva placeholder
 * pasa a `cancelled` con la fecha real de vuelta — sin importar si tardó más
 * o menos de lo estimado. El costo final (si lo hay) se carga como deuda
 * al proveedor/asociado (cuenta corriente de Caja) — el pago real se anota
 * después desde Caja, ver `buildMaintenanceDebt`.
 */
export async function returnVehicleFromService(
  rentalId: string,
  vehicleId: string,
  formData: FormData,
): Promise<void> {
  const user = await requireUser();

  const parsed = closeSchema.safeParse({
    date: formData.get("date"),
    km: formData.get("km"),
    cost: formData.get("cost"),
    accountId: formData.get("accountId") || undefined,
    accountNote: formData.get("accountNote") || undefined,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Datos inválidos.");
  }
  const data = parsed.data;

  const rental = await prisma.rental.findUnique({
    where: { id: rentalId },
    select: { vehicleId: true, status: true },
  });
  if (!rental || rental.vehicleId !== vehicleId || rental.status !== "out_of_service") {
    throw new Error("Esta reserva no está en service.");
  }

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: { plate: true, name: true, brand: true, model: true, currentKm: true, serviceIntervalKm: true },
  });
  if (!vehicle) throw new Error("El vehículo no existe.");

  // El registro que se creó al marcar el service/arreglo en esta reserva —
  // ahí vive el tipo/descripción que se usan para reprogramar el service y
  // para el detalle del gasto/deuda.
  const log = await prisma.maintenanceLog.findFirst({
    where: { rentalId },
    orderBy: { createdAt: "desc" },
    select: { id: true, type: true, description: true, cost: true },
  });
  if (!log) throw new Error("No se encontró el registro de service/arreglo de esta reserva.");

  // "No cargar deuda": el costo queda en el mantenimiento pero la deuda se
  // registra aparte con una compensación (ver MaintenanceDebtAccountField).
  const debt =
    data.cost != null && data.cost > 0 && formData.get("skipDebt") !== "on"
      ? await buildMaintenanceDebt({
          accountId: data.accountId,
          accountNote: data.accountNote,
          amount: data.cost,
          description: `${maintenanceTypeLabels[log.type]} — ${vehicleDisplayName(vehicle)}: ${log.description}`,
          user: { id: user.id, name: displayName(user) },
        })
      : null;

  await prisma.$transaction([
    prisma.maintenanceLog.update({
      where: { id: log.id },
      data: { cost: data.cost ?? log.cost },
    }),
    prisma.vehicle.update({
      where: { id: vehicleId },
      data: {
        status: "available",
        ...(data.km != null && data.km > vehicle.currentKm ? { currentKm: data.km } : {}),
        // Reprogramar el próximo service, igual que al cargar mantenimiento
        // desde la ficha del vehículo — antes esta ruta no lo hacía.
        ...(log.type === "service" && data.km != null && vehicle.serviceIntervalKm
          ? { nextServiceKm: data.km + vehicle.serviceIntervalKm }
          : {}),
        // Service hecho: la alerta pospuesta ya no aplica.
        ...(log.type === "service"
          ? { serviceSnoozedUntilKm: null, serviceSnoozedUntil: null, serviceSnoozedByName: null }
          : {}),
      },
    }),
    // La reserva placeholder ya cumplió su función: se cierra con la fecha
    // real de vuelta (no la estimada al bloquear el auto en VikRentCar).
    prisma.rental.update({
      where: { id: rentalId },
      data: { status: "cancelled", endAt: mendozaWallTimeToUtc(`${data.date}T12:00`) },
    }),
    ...(debt ? [prisma.cashMovement.create({ data: debt })] : []),
  ]);

  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath(`/rentals/${rentalId}`);
  revalidatePath("/rentals");
  revalidatePath("/calendar");
  revalidatePath("/caja");
  redirect(`/vehicles/${vehicleId}`);
}
