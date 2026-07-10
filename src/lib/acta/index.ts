import "server-only";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import { prisma } from "@/lib/prisma";
import { storage, actaKey } from "@/lib/storage";
import { getDictionary, type Locale } from "@/lib/i18n";
import { formatDateTime } from "@/lib/datetime";
import { ActaDocument, type ActaData } from "./pdf";

const MAX_PHOTOS_IN_PDF = 8;

async function toDataUri(key: string | null | undefined): Promise<string | undefined> {
  if (!key) return undefined;
  try {
    const { body, contentType } = await storage().get(key);
    return `data:${contentType};base64,${body.toString("base64")}`;
  } catch {
    return undefined;
  }
}

/** Arma los datos del acta y renderiza el PDF a buffer. Regenerable en cualquier momento. */
export async function renderActaBuffer(inspectionId: string): Promise<Buffer> {
  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    include: { rental: true, vehicle: true, media: true, damages: true },
  });
  if (!inspection) throw new Error(`inspection ${inspectionId} not found`);

  const locale = inspection.rental.language as Locale;
  const dict = getDictionary(locale);

  // Mapear ids del checklist a etiquetas.
  const items = await prisma.checklistItem.findMany();
  const labelById = new Map(items.map((i) => [i.id, i.label]));
  const responses = (inspection.checklistResponses ?? {}) as Record<string, "ok" | "fail">;
  const checklist = Object.entries(responses).map(([id, status]) => ({
    label: labelById.get(id) ?? id,
    status,
  }));

  // Imágenes → data URIs.
  const photoKeys = inspection.media.filter((m) => m.type === "photo").map((m) => m.url);
  const photoDataUris = (
    await Promise.all(photoKeys.slice(0, MAX_PHOTOS_IN_PDF).map((k) => toDataUri(k)))
  ).filter((x): x is string => Boolean(x));
  const signatureDataUri = await toDataUri(inspection.signatureUrl);

  const data: ActaData = {
    kind: inspection.type === "handover" ? "handover" : "return",
    dict,
    vehicleLabel: `${inspection.vehicle.brand} ${inspection.vehicle.model}`,
    plate: inspection.vehicle.plate,
    clientName: inspection.rental.clientName,
    dateStr: formatDateTime(inspection.createdAt, locale),
    km: inspection.km,
    fuelLevel: inspection.fuelLevel,
    checklist,
    damages: inspection.damages.map((d) => ({ view: d.view, description: d.description })),
    observations: inspection.observations,
    signerName: inspection.signerName,
    signatureDataUri,
    photoDataUris,
  };

  const element = createElement(ActaDocument, data) as unknown as ReactElement<DocumentProps>;
  return renderToBuffer(element);
}

/** Genera el acta, la guarda en el almacenamiento y envía los emails (async, post-guardado). */
export async function generateAndSendActa(inspectionId: string): Promise<void> {
  const pdf = await renderActaBuffer(inspectionId);
  await storage().put(actaKey(inspectionId), pdf, "application/pdf");

  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    include: { rental: true },
  });
  if (!inspection) return;

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    console.warn("[acta] Resend no configurado — PDF guardado, email omitido");
    return;
  }

  const locale = inspection.rental.language as Locale;
  const dict = getDictionary(locale);
  const isHandover = inspection.type === "handover";
  const subject = isHandover ? dict.email.handoverSubject : dict.email.returnSubject;
  const body = isHandover ? dict.email.handoverBody : dict.email.returnBody;

  const to: string[] = [];
  if (inspection.rental.clientEmail) to.push(inspection.rental.clientEmail);
  const admin = process.env.ADMIN_EMAIL;
  if (to.length === 0 && admin) to.push(admin);
  if (to.length === 0) {
    console.warn("[acta] sin destinatario (ni cliente ni admin) — email omitido");
    return;
  }

  const html = `<p>${dict.email.greeting} ${inspection.rental.clientName},</p><p>${body}</p><p>${dict.email.attachmentNote}</p><p>${dict.email.regards.replace(/\n/g, "<br>")}</p>`;

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  await resend.emails.send({
    from,
    to,
    cc: admin && !to.includes(admin) ? [admin] : undefined,
    subject,
    html,
    attachments: [
      {
        filename: `acta-${isHandover ? "entrega" : "devolucion"}-${inspectionId}.pdf`,
        content: pdf,
      },
    ],
  });
}
