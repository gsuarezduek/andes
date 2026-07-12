"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/auth-helpers";

export type FormState = { error?: string };

const optionalInt = z.preprocess(
  (v) => (v === "" || v == null ? undefined : Number(v)),
  z.number({ error: "Debe ser un número" }).int().nonnegative().optional(),
);

const vehicleSchema = z.object({
  plate: z.string().trim().min(1, "La patente es obligatoria").max(16),
  brand: z.string().trim().min(1, "La marca es obligatoria"),
  model: z.string().trim().min(1, "El modelo es obligatorio"),
  year: z.preprocess(
    (v) => (v === "" || v == null ? undefined : Number(v)),
    z.number().int().min(1950).max(2100).optional(),
  ),
  color: z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined),
    z.string().optional(),
  ),
  currentKm: z.preprocess(
    (v) => (v === "" || v == null ? 0 : Number(v)),
    z.number().int().nonnegative(),
  ),
  status: z.enum(["available", "rented", "out_of_service"]),
  nextServiceKm: optionalInt,
  serviceIntervalKm: optionalInt,
  notes: z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined),
    z.string().optional(),
  ),
});

function parse(formData: FormData) {
  return vehicleSchema.safeParse({
    plate: formData.get("plate"),
    brand: formData.get("brand"),
    model: formData.get("model"),
    year: formData.get("year"),
    color: formData.get("color"),
    currentKm: formData.get("currentKm"),
    status: formData.get("status"),
    nextServiceKm: formData.get("nextServiceKm"),
    serviceIntervalKm: formData.get("serviceIntervalKm"),
    notes: formData.get("notes"),
  });
}

export async function createVehicle(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireAdmin();
  const parsed = parse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    await prisma.vehicle.create({ data: { ...parsed.data, plate: parsed.data.plate.toUpperCase() } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "Ya existe un vehículo con esa patente." };
    }
    throw e;
  }

  revalidatePath("/vehicles");
  redirect("/vehicles");
}

export async function updateVehicle(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const parsed = parse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  try {
    await prisma.vehicle.update({
      where: { id },
      data: { ...parsed.data, plate: parsed.data.plate.toUpperCase() },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "Ya existe un vehículo con esa patente." };
    }
    throw e;
  }

  revalidatePath("/vehicles");
  redirect(`/vehicles/${id}`);
}

/**
 * Baja de la flota operativa. No borra nada: el histórico, las actas y los
 * daños se conservan. Guarda: no se puede archivar un auto alquilado ni con un
 * alquiler activo abierto (primero se cierra la devolución).
 */
export async function archiveVehicle(id: string): Promise<void> {
  await requireAdmin();

  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    select: {
      status: true,
      _count: { select: { rentals: { where: { status: "active" } } } },
    },
  });
  if (!vehicle) return;
  if (vehicle.status === "rented" || vehicle._count.rentals > 0) {
    throw new Error("No se puede archivar un auto con un alquiler activo. Cerrá la devolución primero.");
  }

  await prisma.vehicle.update({ where: { id }, data: { archivedAt: new Date() } });
  revalidatePath("/vehicles");
  revalidatePath(`/vehicles/${id}`);
}

/** Reactiva un auto archivado, devolviéndolo a la flota operativa. */
export async function unarchiveVehicle(id: string): Promise<void> {
  await requireAdmin();
  await prisma.vehicle.update({ where: { id }, data: { archivedAt: null } });
  revalidatePath("/vehicles");
  revalidatePath(`/vehicles/${id}`);
}
