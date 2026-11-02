"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireUser } from "@/lib/auth-helpers";
import { displayName } from "@/lib/user-display";
import { mendozaWallTimeToUtc } from "@/lib/datetime";
import { storage } from "@/lib/storage";
import {
  buildConditionSnapshot,
  OWNER_CONTRACT_STEPS,
  validateOwnerContractStep,
} from "@/lib/owner-contract";
import { ownerSignatureKey, sendOwnerContract } from "@/lib/owner-contract-server";

const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024;
const PNG_PREFIX = "data:image/png;base64,";

const inputSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  vehicleId: z.string().min(1),
  versionId: z.string().min(1).nullable(),
  draft: z.object({
    ownerName: z.string(),
    ownerDocNumber: z.string(),
    ownerAddress: z.string(),
    ownerEmail: z.string(),
    ownerPhone: z.string(),
    place: z.string(),
    startDate: z.string(),
    startTime: z.string(),
    endDate: z.string(),
    endTime: z.string(),
    commercialTerms: z.string(),
    km: z.string(),
    fuelLevel: z.number().int().min(0),
    responses: z.record(z.string(), z.union([z.string(), z.boolean()])),
    observations: z.string(),
    companySignerName: z.string(),
  }),
  companySignature: z.string(),
  ownerSignature: z.string(),
});

export type CreateOwnerContractInput = z.infer<typeof inputSchema>;
export type OwnerContractResult = { ok: true } | { ok: false; error: string };

function decodeSignature(dataUrl: string): Buffer | null {
  if (!dataUrl.startsWith(PNG_PREFIX)) return null;
  const buffer = Buffer.from(dataUrl.slice(PNG_PREFIX.length), "base64");
  const isPng = buffer.length > 8 && buffer.toString("latin1", 1, 4) === "PNG";
  return isPng && buffer.length <= MAX_SIGNATURE_BYTES ? buffer : null;
}

const orNull = (s: string) => s.trim() || null;

/**
 * Guarda el contrato ya firmado por las dos partes. Idempotente por `id` (lo
 * genera el wizard): reintentar con mala señal no crea un segundo contrato. El
 * PDF y los emails van después de responder, para no demorar la confirmación.
 */
export async function createOwnerContract(input: CreateOwnerContractInput): Promise<OwnerContractResult> {
  const user = await requireUser();

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos." };
  const { id, vehicleId, versionId, draft } = parsed.data;

  const existing = await prisma.ownerContract.findUnique({ where: { id }, select: { id: true } });
  if (existing) return { ok: true };

  for (let step = 0; step < OWNER_CONTRACT_STEPS.length; step++) {
    const error = validateOwnerContractStep(step, draft);
    if (error) return { ok: false, error };
  }

  const companySignature = decodeSignature(parsed.data.companySignature);
  const ownerSignature = decodeSignature(parsed.data.ownerSignature);
  if (!companySignature) return { ok: false, error: "Falta la firma de MDZ Rent a Car." };
  if (!ownerSignature) return { ok: false, error: "Falta la firma del propietario." };

  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) return { ok: false, error: "El vehículo no existe." };
  if (vehicle.ownership !== "third_party") {
    return { ok: false, error: "El contrato de cesión es solo para autos de terceros." };
  }
  if (draft.fuelLevel > vehicle.fuelLevels) return { ok: false, error: "El nivel de combustible no es válido." };

  if (versionId) {
    const version = await prisma.ownerContractVersion.findUnique({ where: { id: versionId }, select: { id: true } });
    if (!version) return { ok: false, error: "Las condiciones cambiaron. Recargá la página y volvé a firmar." };
  }

  const companySignatureKey = ownerSignatureKey(id, "company");
  const signatureOwnerKey = ownerSignatureKey(id, "owner");
  await Promise.all([
    storage().put(companySignatureKey, companySignature, "image/png"),
    storage().put(signatureOwnerKey, ownerSignature, "image/png"),
  ]);

  const owner = {
    ownerName: draft.ownerName.trim(),
    ownerDocNumber: draft.ownerDocNumber.trim(),
    ownerAddress: draft.ownerAddress.trim(),
    ownerEmail: orNull(draft.ownerEmail),
    ownerPhone: orNull(draft.ownerPhone),
  };

  try {
    await prisma.$transaction([
      prisma.ownerContract.create({
        data: {
          id,
          vehicleId,
          versionId,
          place: draft.place.trim(),
          startsAt: mendozaWallTimeToUtc(`${draft.startDate}T${draft.startTime}`),
          endsAt: mendozaWallTimeToUtc(`${draft.endDate}T${draft.endTime}`),
          ...owner,
          vehicleBrand: vehicle.brand,
          vehicleModel: vehicle.model,
          vehicleYear: vehicle.year,
          vehiclePlate: vehicle.plate,
          insuranceCompany: vehicle.insuranceCompany,
          insurancePolicyNumber: vehicle.insurancePolicyNumber,
          commercialTerms: orNull(draft.commercialTerms),
          km: Number(draft.km.trim()),
          fuelLevel: draft.fuelLevel,
          fuelLevels: vehicle.fuelLevels,
          condition: buildConditionSnapshot(draft.responses),
          observations: orNull(draft.observations),
          companySignerName: draft.companySignerName.trim(),
          companySignatureKey,
          ownerSignerName: owner.ownerName,
          ownerSignatureKey: signatureOwnerKey,
          createdById: user.id,
          createdByName: displayName(user),
        },
      }),
      // La ficha queda con los últimos datos firmados: precargan la próxima renovación.
      prisma.vehicle.update({ where: { id: vehicleId }, data: owner }),
    ]);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: true };
    throw e;
  }

  after(async () => {
    try {
      await sendOwnerContract(id);
    } catch (e) {
      console.error(`[owner-contract] no se pudo enviar el contrato ${id}`, e);
    }
  });

  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath("/third-party-vehicles");
  return { ok: true };
}

/** Reenvía el PDF al propietario (y la copia al admin). Devuelve cómo le fue al del propietario. */
export async function resendOwnerContract(id: string, vehicleId: string): Promise<OwnerContractResult> {
  await requireUser();
  const result = await sendOwnerContract(id);
  revalidatePath(`/vehicles/${vehicleId}`);
  return result.status === "sent" ? { ok: true } : { ok: false, error: result.error ?? "No se pudo enviar." };
}

/**
 * Da de baja un contrato (se terminó antes o se firmó con un error): deja de
 * contar como vigente, pero sigue en el historial con su PDF. No se puede deshacer.
 */
export async function voidOwnerContract(id: string, vehicleId: string, reason: string): Promise<OwnerContractResult> {
  const user = await requireAdmin();
  const voidedReason = reason.trim();
  if (!voidedReason) return { ok: false, error: "Contá el motivo de la baja." };

  const { count } = await prisma.ownerContract.updateMany({
    where: { id, vehicleId, voidedAt: null },
    data: { voidedAt: new Date(), voidedReason, voidedByName: displayName(user) },
  });
  if (count === 0) return { ok: false, error: "El contrato ya estaba dado de baja." };

  revalidatePath(`/vehicles/${vehicleId}`);
  revalidatePath("/third-party-vehicles");
  return { ok: true };
}
