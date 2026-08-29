"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/auth-helpers";

export type FormState = { error?: string };

// Vacío → null (no undefined): en updateVehicle, Prisma ignora undefined (no
// actualiza), así que un campo borrado quedaría con el valor viejo. Con null se
// limpia de verdad la columna.
const optionalInt = z.preprocess(
  (v) => (v === "" || v == null ? null : Number(v)),
  z.number({ error: "Debe ser un número" }).int().nonnegative().nullable(),
);

// Texto recortado, o null si viene vacío (limpia la columna en updateVehicle).
const optionalStr = z.preprocess(
  (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null),
  z.string().nullable(),
);

// Datos operativos del día a día: cualquier empleado los puede editar.
const operationalSchema = z.object({
  currentKm: z.preprocess(
    (v) => (v === "" || v == null ? 0 : Number(v)),
    z.number().int().nonnegative(),
  ),
  status: z.enum(["available", "rented", "out_of_service"]),
  fuelLevels: z.preprocess(
    (v) => (v === "" || v == null ? 8 : Number(v)),
    z.number().int().min(4, "Mínimo 4 líneas").max(16, "Máximo 16 líneas"),
  ),
  nextServiceKm: optionalInt,
  serviceIntervalKm: optionalInt,
  notes: optionalStr,
  // Apodo interno (no es dato legal/identidad), cualquier empleado lo puede cargar.
  name: optionalStr,
});

// Identidad y datos legales del vehículo: sensibles y difíciles de auditar
// (patente, chasis, seguro), solo los toca un admin. Ver operationalSchema
// para lo que sí puede tocar cualquier empleado.
const adminOnlySchema = z.object({
  plate: z.string().trim().min(1, "La patente es obligatoria").max(16),
  brand: z.string().trim().min(1, "La marca es obligatoria"),
  model: z.string().trim().min(1, "El modelo es obligatorio"),
  year: z.preprocess(
    (v) => (v === "" || v == null ? null : Number(v)),
    z.number().int().min(1950).max(2100).nullable(),
  ),
  color: z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null),
    z.string().nullable(),
  ),
  engineNumber: optionalStr,
  chassisNumber: optionalStr,
  insurancePolicyNumber: optionalStr,
  insuranceCompany: optionalStr,
  // Categoría interna para comparar contra "Precios de la competencia"
  // (columna "Nosotros"). No es un dato legal, pero vive junto a los demás
  // campos admin-only por consistencia con el resto de esa sección.
  competitorCategoryId: optionalStr,
});

const vehicleSchema = operationalSchema.merge(adminOnlySchema);

function parseOperational(formData: FormData) {
  return operationalSchema.safeParse({
    currentKm: formData.get("currentKm"),
    status: formData.get("status"),
    fuelLevels: formData.get("fuelLevels"),
    nextServiceKm: formData.get("nextServiceKm"),
    serviceIntervalKm: formData.get("serviceIntervalKm"),
    notes: formData.get("notes"),
    name: formData.get("name"),
  });
}

function parse(formData: FormData) {
  return vehicleSchema.safeParse({
    currentKm: formData.get("currentKm"),
    status: formData.get("status"),
    fuelLevels: formData.get("fuelLevels"),
    nextServiceKm: formData.get("nextServiceKm"),
    serviceIntervalKm: formData.get("serviceIntervalKm"),
    notes: formData.get("notes"),
    name: formData.get("name"),
    plate: formData.get("plate"),
    brand: formData.get("brand"),
    model: formData.get("model"),
    year: formData.get("year"),
    color: formData.get("color"),
    engineNumber: formData.get("engineNumber"),
    chassisNumber: formData.get("chassisNumber"),
    insurancePolicyNumber: formData.get("insurancePolicyNumber"),
    insuranceCompany: formData.get("insuranceCompany"),
    competitorCategoryId: formData.get("competitorCategoryId"),
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
  const user = await requireUser();

  // Un empleado no-admin solo puede tocar lo operativo (estado, km, notas).
  // Esto no es solo un chequeo de UI: aunque alguien manipule el formulario a
  // mano y mande patente/chasis/seguro igual, acá se ignoran por completo —
  // ni siquiera se parsean — para un usuario que no sea admin.
  if (user.role !== "admin") {
    const parsed = parseOperational(formData);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    await prisma.vehicle.update({ where: { id }, data: parsed.data });
    revalidatePath("/vehicles");
    redirect(`/vehicles/${id}`);
  }

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
