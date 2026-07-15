"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { generateAndSendActa } from "@/lib/acta";
import type { InspectionInput, SaveResult } from "@/lib/inspection-input";

const damageSchema = z.object({
  view: z.enum(["top", "front", "rear", "left", "right", "interior"]),
  posX: z.number().min(0).max(1),
  posY: z.number().min(0).max(1),
  description: z.string().optional(),
  photoKey: z.string().optional(),
});

const settlementSchema = z
  .object({
    kmDriven: z.number(),
    includedKm: z.number(),
    extraKm: z.number(),
    extraKmRate: z.number(),
    extraKmCharge: z.number(),
    fuelMissingEighths: z.number(),
    fuelCharge: z.number(),
    damageCharges: z.array(z.object({ description: z.string(), amount: z.number() })),
    damagesTotal: z.number(),
    subtotal: z.number(),
    deposit: z.number(),
    depositApplied: z.number(),
    balanceDue: z.number(),
    depositReturn: z.number(),
    method: z.enum(["efectivo", "transferencia", "retencion_deposito", "none"]),
    note: z.string().optional(),
  })
  .optional();

const saveSchema = z.object({
  rentalId: z.string().min(1),
  vehicleId: z.string().min(1, "Falta el vehículo"),
  language: z.enum(["es", "en"]),
  km: z.number().int().nonnegative(),
  fuelLevel: z.number().int().min(0).max(16),
  checklist: z.record(z.string(), z.enum(["ok", "fail"])),
  observations: z.string().optional(),
  newDamages: z.array(damageSchema),
  photoKeys: z.array(z.string()),
  videoKey: z.string().optional(),
  signatureKey: z.string().min(1, "Falta la firma del cliente"),
  signerName: z.string().min(1, "Falta la aclaración de la firma"),
  settlement: settlementSchema,
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

export async function saveReturn(input: InspectionInput): Promise<SaveResult> {
  const user = await requireUser();

  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const data = parsed.data;

  const rental = await prisma.rental.findUnique({
    where: { id: data.rentalId },
    include: { inspections: { select: { id: true, type: true, km: true } } },
  });
  if (!rental) return { ok: false, error: "El alquiler no existe." };
  if (rental.status !== "active") {
    return { ok: false, error: "Solo se puede devolver un alquiler activo." };
  }
  const handover = rental.inspections.find((i) => i.type === "handover");
  if (!handover) return { ok: false, error: "Este alquiler no tiene entrega registrada." };
  if (rental.inspections.some((i) => i.type === "return_")) {
    return { ok: false, error: "Ya existe un acta de devolución para este alquiler." };
  }

  // El km de devolución no puede ser menor al de entrega.
  if (data.km < handover.km) {
    return { ok: false, error: `El kilometraje no puede ser menor al de entrega (${handover.km.toLocaleString("es-AR")} km).` };
  }

  const inspection = await prisma.$transaction(async (tx) => {
    const insp = await tx.inspection.create({
      data: {
        type: "return_",
        rentalId: rental.id,
        vehicleId: data.vehicleId,
        userId: user.id,
        km: data.km,
        fuelLevel: data.fuelLevel,
        checklistResponses: data.checklist,
        observations: data.observations ?? null,
        signatureUrl: data.signatureKey,
        signerName: data.signerName,
        settlement: data.settlement ?? undefined,
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
            vehicleId: data.vehicleId,
            view: d.view,
            posX: d.posX,
            posY: d.posY,
            description: d.description ?? null,
            photoUrl: d.photoKey ?? null,
            reportedById: user.id,
          })),
        },
      },
    });

    await tx.rental.update({
      where: { id: rental.id },
      data: { status: "finished", language: data.language },
    });
    await tx.vehicle.update({
      where: { id: data.vehicleId },
      data: { status: "available", currentKm: data.km },
    });

    return insp;
  });

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
