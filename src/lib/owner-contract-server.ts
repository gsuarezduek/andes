import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import { prisma } from "@/lib/prisma";
import { storage } from "@/lib/storage";
import { sendActaEmailTo, type EmailAttempt } from "@/lib/acta";
import { resolveEmailConfig } from "@/lib/email/settings";
import { formatDate, formatTime } from "@/lib/datetime";
import { ORIGINAL_OWNER_CONTRACT_TEXT, type ConditionGroup } from "@/lib/owner-contract";
import { OwnerContractDocument } from "@/lib/owner-contract-pdf";

let logoCache: string | null = null;

/** Logo de MDZ en blanco y negro (public/brand), como data URI para react-pdf. */
async function logoDataUri(): Promise<string> {
  if (!logoCache) {
    const buf = await readFile(path.join(process.cwd(), "public", "brand", "mdz-logo-bw.png"));
    logoCache = `data:image/png;base64,${buf.toString("base64")}`;
  }
  return logoCache;
}

export type OwnerContractText = { versionId: string | null; title: string; body: string };

/** Condiciones vigentes: la versión más nueva de Configuración, o el texto original. */
export async function getCurrentOwnerContractText(): Promise<OwnerContractText> {
  const v = await prisma.ownerContractVersion.findFirst({
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, body: true },
  });
  return v ? { versionId: v.id, title: v.title, body: v.body } : { versionId: null, ...ORIGINAL_OWNER_CONTRACT_TEXT };
}

/** Filtro de Prisma para traer solo contratos vigentes hoy. */
export function activeOwnerContractWhere() {
  const now = new Date();
  return { voidedAt: null, startsAt: { lte: now }, endsAt: { gt: now } };
}

export function ownerSignatureKey(contractId: string, party: "company" | "owner"): string {
  return `owner-contracts/${contractId}/${party}/signature.png`;
}

async function toDataUri(key: string, contractId: string): Promise<string | undefined> {
  try {
    const { body, contentType } = await storage().get(key);
    return `data:${contentType};base64,${body.toString("base64")}`;
  } catch (e) {
    console.error(`[owner-contract] no se pudo leer la firma (contrato ${contractId}, key "${key}")`, e);
    return undefined;
  }
}

/** Arma el PDF desde los datos firmados: siempre sale igual, aunque cambie la ficha o las condiciones. */
export async function renderOwnerContractBuffer(id: string): Promise<Buffer> {
  const c = await prisma.ownerContract.findUnique({
    where: { id },
    include: { version: { select: { title: true, body: true } } },
  });
  if (!c) throw new Error(`owner contract ${id} not found`);

  const text = c.version ?? ORIGINAL_OWNER_CONTRACT_TEXT;
  const [companySignatureDataUri, ownerSignatureDataUri] = await Promise.all([
    toDataUri(c.companySignatureKey, id),
    toDataUri(c.ownerSignatureKey, id),
  ]);

  const element = createElement(OwnerContractDocument, {
    logoDataUri: await logoDataUri(),
    number: c.number,
    textTitle: text.title,
    textBody: text.body,
    place: c.place,
    dateLabel: formatDate(c.createdAt),
    startDate: formatDate(c.startsAt),
    startTime: formatTime(c.startsAt),
    endDate: formatDate(c.endsAt),
    endTime: formatTime(c.endsAt),
    ownerName: c.ownerName,
    ownerDocNumber: c.ownerDocNumber,
    ownerAddress: c.ownerAddress,
    ownerEmail: c.ownerEmail,
    ownerPhone: c.ownerPhone,
    vehicleBrand: c.vehicleBrand,
    vehicleModel: c.vehicleModel,
    vehicleYear: c.vehicleYear,
    vehiclePlate: c.vehiclePlate,
    insuranceCompany: c.insuranceCompany,
    insurancePolicyNumber: c.insurancePolicyNumber,
    commercialTerms: c.commercialTerms,
    km: c.km,
    fuelLevel: c.fuelLevel,
    fuelLevels: c.fuelLevels,
    condition: c.condition as ConditionGroup[],
    observations: c.observations,
    companySignerName: c.companySignerName,
    companySignatureDataUri,
    ownerSignerName: c.ownerSignerName,
    ownerSignatureDataUri,
  }) as unknown as ReactElement<DocumentProps>;
  return renderToBuffer(element);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Manda el contrato al propietario y al admin, por separado (un email inválido
 * del propietario no puede dejar al admin sin su copia) y registra cómo le fue
 * al envío del propietario. Nunca tira por un rechazo de la API de email.
 */
export async function sendOwnerContract(id: string): Promise<EmailAttempt> {
  const c = await prisma.ownerContract.findUnique({
    where: { id },
    select: { number: true, ownerName: true, ownerEmail: true, vehicleBrand: true, vehicleModel: true, vehiclePlate: true },
  });
  if (!c) throw new Error(`owner contract ${id} not found`);

  const apiKey = process.env.RESEND_API_KEY;
  const from = (await resolveEmailConfig("es")).from ?? process.env.EMAIL_FROM;

  let result: EmailAttempt;
  if (!apiKey || !from) {
    console.warn("[owner-contract] Resend no configurado — email omitido");
    result = { status: "skipped", error: "Resend no está configurado (falta API key o remitente)." };
  } else {
    const pdf = await renderOwnerContractBuffer(id);
    const vehicle = `${c.vehicleBrand} ${c.vehicleModel} (${c.vehiclePlate})`;
    const subject = `Contrato de cesión N.º ${c.number} — ${vehicle}`;
    const html = `<p>Hola ${escapeHtml(c.ownerName)},</p><p>Te enviamos adjunta la copia firmada del contrato de cesión de tu vehículo ${escapeHtml(vehicle)}.</p><p>Muchas gracias,<br>MDZ Rent a Car</p>`;
    const filename = `contrato-cesion-${c.number}.pdf`;
    const { Resend } = await import("resend");
    const resend = new Resend(apiKey);

    result = c.ownerEmail
      ? await sendActaEmailTo(resend, { from, to: c.ownerEmail, subject, html, pdf, filename })
      : { status: "skipped", error: "El contrato no tiene un email del propietario." };

    const admin = process.env.ADMIN_EMAIL;
    if (admin) {
      const adminResult = await sendActaEmailTo(resend, { from, to: admin, subject, html, pdf, filename });
      if (adminResult.status === "failed") {
        console.error(`[owner-contract] envío al admin falló (contrato ${id}): ${adminResult.error}`);
      }
    }
  }

  await prisma.ownerContract.update({
    where: { id },
    data: { emailStatus: result.status, emailError: result.error ?? null, emailSentAt: result.sentAt ?? null },
  });
  if (result.status === "failed") {
    console.error(`[owner-contract] envío al propietario falló (contrato ${id}): ${result.error}`);
  }
  return result;
}
