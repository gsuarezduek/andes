"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { generateAndSendActa } from "@/lib/acta";
import { paymentsToCashMovements } from "@/lib/cash";
import { paymentSchema } from "@/lib/payment-schema";
import { computeSettlement, rollupSettlement } from "@/lib/settlement";
import type { ContractPricing } from "@/lib/contract";
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
    payments: z.array(paymentSchema).optional(),
    // Compat: devoluciones de versiones anteriores a los pagos con medio real.
    method: z.enum(["efectivo", "transferencia", "retencion_deposito", "none"]).optional(),
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
    include: { inspections: { select: { id: true, type: true, km: true, fuelLevel: true } } },
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

  // La liquidación que firma el cliente no se persiste tal cual la manda el
  // cliente: kmDriven/includedKm/extraKm/fuelMissingEighths y sobre todo los
  // totales (subtotal, saldo a cobrar, depósito a devolver) se recalculan acá
  // a partir de datos de confianza (la entrega y `Rental.pricing`, ambos ya
  // en la base) en vez de aceptar la aritmética que mandó el cliente — el
  // empleado sigue pudiendo editar los importes de km extra/nafta/daños/
  // depósito (son legítimamente ajustables), pero no puede hacer que el
  // saldo final quede desacoplado de esos importes.
  const settlementForPersist = data.settlement
    ? rollupSettlement({
        ...computeSettlement({
          handoverKm: handover.km,
          returnKm: data.km,
          handoverFuel: handover.fuelLevel,
          returnFuel: data.fuelLevel,
          pricing: rental.pricing as ContractPricing | null,
          newDamages: data.newDamages,
        }),
        extraKmCharge: data.settlement.extraKmCharge,
        fuelCharge: data.settlement.fuelCharge,
        deposit: data.settlement.deposit,
        damageCharges: data.settlement.damageCharges,
        payments: data.settlement.payments,
        method: data.settlement.method,
        note: data.settlement.note,
      })
    : undefined;

  let inspection;
  try {
    inspection = await prisma.$transaction(async (tx) => {
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
          settlement: settlementForPersist ?? undefined,
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

      // Cada pago anotado en la liquidación queda también como ingreso en Caja,
      // vinculado a esta reserva — el empleado no lo anota dos veces. Las
      // líneas con `cashMovementId` ya tienen su movimiento (cargadas antes
      // vía "Agregar pago", o importadas del sync): no se recrean.
      const newPayments = settlementForPersist?.payments?.filter((p) => !p.cashMovementId) ?? [];
      if (newPayments.length) {
        await tx.cashMovement.createMany({
          data: paymentsToCashMovements(newPayments, {
            rentalId: rental.id,
            createdById: user.id,
            description: `Ingreso de devolución — ${rental.clientName}`,
          }),
        });
      }

      return insp;
    });
  } catch (e) {
    // Dos guardados concurrentes para la misma reserva: el
    // `@@unique([rentalId, type])` de Inspection choca acá y aborta toda la
    // transacción (nada de acta/cobro/cambio de estado duplicado).
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "Ya se guardó una devolución para este alquiler (recargá la página)." };
    }
    throw e;
  }

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
