"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { env } from "@/lib/env";
import { qrSvg } from "@/lib/qr";
import { SIGNATURE_REQUEST_TTL_MS } from "@/lib/remote-signature";

const inputSchema = z.object({
  rentalId: z.string().min(1),
  draftId: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  type: z.enum(["handover", "return"]),
  language: z.enum(["es", "en"]),
  summary: z.object({
    vehicleLabel: z.string(),
    km: z.number(),
    fuelLevel: z.number(),
    newDamages: z.array(z.string()),
    observations: z.string().optional(),
    clientName: z.string().optional(),
    datesLabel: z.string().optional(),
  }),
});

export type CreateRemoteSignatureInput = z.infer<typeof inputSchema>;

export type CreateRemoteSignatureResult =
  | { ok: true; id: string; url: string; svg: string }
  | { ok: false; error: string };

/**
 * Crea un pedido de firma remota y devuelve el QR (SVG) que el empleado muestra
 * en su pantalla para que el cliente lo escanee y firme en su propio teléfono.
 */
export async function createRemoteSignature(
  input: CreateRemoteSignatureInput,
): Promise<CreateRemoteSignatureResult> {
  await requireUser();

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Datos inválidos" };
  const data = parsed.data;

  const rental = await prisma.rental.findUnique({ where: { id: data.rentalId }, select: { id: true } });
  if (!rental) return { ok: false, error: "El alquiler no existe." };

  const user = await requireUser();
  const request = await prisma.signatureRequest.create({
    data: {
      draftId: data.draftId,
      rentalId: data.rentalId,
      type: data.type === "handover" ? "handover" : "return_",
      language: data.language,
      summary: data.summary,
      signerName: data.summary.clientName ?? null,
      createdById: user.id,
      expiresAt: new Date(Date.now() + SIGNATURE_REQUEST_TTL_MS),
    },
    select: { id: true },
  });

  const url = `${env.appUrl.replace(/\/$/, "")}/sign/${request.id}`;
  const svg = await qrSvg(url);
  return { ok: true, id: request.id, url, svg };
}
