"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { generateAndSendActa } from "@/lib/acta";

const damageSchema = z.object({
  view: z.enum(["top", "front", "rear", "left", "right", "interior"]),
  posX: z.number().min(0).max(1),
  posY: z.number().min(0).max(1),
  description: z.string().optional(),
  photoKey: z.string().optional(),
});

const saveSchema = z.object({
  rentalId: z.string().min(1),
  vehicleId: z.string().min(1, "Falta asignar un vehículo"),
  language: z.enum(["es", "en"]),
  km: z.number().int().nonnegative(),
  fuelLevel: z.number().int().min(0).max(8),
  checklist: z.record(z.string(), z.enum(["ok", "fail"])),
  observations: z.string().optional(),
  newDamages: z.array(damageSchema),
  photoKeys: z.array(z.string()),
  videoKey: z.string().optional(),
  signatureKey: z.string().min(1, "Falta la firma del cliente"),
  signerName: z.string().min(1, "Falta la aclaración de la firma"),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export type SaveHandoverInput = z.infer<typeof saveSchema>;
export type SaveResult = { ok: true; inspectionId: string } | { ok: false; error: string };

export async function saveHandover(input: SaveHandoverInput): Promise<SaveResult> {
  const user = await requireUser();

  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const data = parsed.data;

  const rental = await prisma.rental.findUnique({
    where: { id: data.rentalId },
    include: { inspections: { where: { type: "handover" }, select: { id: true } } },
  });
  if (!rental) return { ok: false, error: "El alquiler no existe." };
  if (rental.status !== "reserved") {
    return { ok: false, error: "Este alquiler ya tiene la entrega registrada o no está reservado." };
  }
  if (rental.inspections.length > 0) {
    return { ok: false, error: "Ya existe un acta de entrega para este alquiler." };
  }

  const vehicle = await prisma.vehicle.findUnique({ where: { id: data.vehicleId } });
  if (!vehicle) return { ok: false, error: "El vehículo no existe." };

  const inspection = await prisma.$transaction(async (tx) => {
    const insp = await tx.inspection.create({
      data: {
        type: "handover",
        rentalId: rental.id,
        vehicleId: vehicle.id,
        userId: user.id,
        km: data.km,
        fuelLevel: data.fuelLevel,
        checklistResponses: data.checklist,
        observations: data.observations ?? null,
        signatureUrl: data.signatureKey,
        signerName: data.signerName,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        media: {
          create: [
            ...data.photoKeys.map((key) => ({
              type: "photo" as const,
              url: key,
              capturedAt: new Date(),
            })),
            ...(data.videoKey
              ? [{ type: "video" as const, url: data.videoKey, capturedAt: new Date() }]
              : []),
          ],
        },
        damages: {
          create: data.newDamages.map((d) => ({
            vehicleId: vehicle.id,
            view: d.view,
            posX: d.posX,
            posY: d.posY,
            description: d.description ?? null,
            photoUrl: d.photoKey ?? null,
          })),
        },
      },
    });

    await tx.rental.update({
      where: { id: rental.id },
      data: { status: "active", vehicleId: vehicle.id, language: data.language },
    });
    await tx.vehicle.update({
      where: { id: vehicle.id },
      data: { status: "rented", currentKm: data.km },
    });

    return insp;
  });

  // Post-guardado asíncrono: PDF + emails, sin bloquear la confirmación.
  after(async () => {
    try {
      await generateAndSendActa(inspection.id);
    } catch (e) {
      console.error("acta generation failed", e);
    }
  });

  revalidatePath(`/rentals/${rental.id}`);
  revalidatePath("/rentals");
  return { ok: true, inspectionId: inspection.id };
}
