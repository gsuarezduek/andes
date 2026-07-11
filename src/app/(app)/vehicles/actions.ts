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
