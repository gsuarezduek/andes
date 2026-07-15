import "server-only";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import { prisma } from "@/lib/prisma";
import { storage, actaKey } from "@/lib/storage";
import { getDictionary, type Locale } from "@/lib/i18n";
import { resolveEmailConfig } from "@/lib/email/settings";
import { formatDateTime, formatDate } from "@/lib/datetime";
import { COMPANY, formatArs, PRICING_FIELDS, extraHourAmount, type ContractPricing } from "@/lib/contract";
import { computeComparison } from "@/lib/comparison";
import type { Settlement } from "@/lib/settlement";
import { ActaDocument, type ActaData, type ActaRow } from "./pdf";

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
    include: {
      rental: true,
      vehicle: true,
      media: true,
      damages: true,
      user: { select: { name: true } },
    },
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

  const r = inspection.rental;
  const t = dict.acta;

  // Datos del cliente.
  const clientRows: ActaRow[] = [{ label: t.client, value: r.clientName }];
  if (r.clientDocNumber) clientRows.push({ label: t.dni, value: r.clientDocNumber });
  if (r.clientCountry) clientRows.push({ label: t.country, value: r.clientCountry });
  if (r.licenseExpiry)
    clientRows.push({ label: t.licenseExpiry, value: formatDate(r.licenseExpiry, locale) });
  if (r.clientEmail) clientRows.push({ label: "Email", value: r.clientEmail });
  if (r.clientPhone) clientRows.push({ label: "Tel.", value: r.clientPhone });

  // Condiciones del alquiler (fechas + importes registrados).
  const pricing = (r.pricing ?? {}) as ContractPricing;
  const termRows: ActaRow[] = [
    { label: t.from, value: formatDateTime(r.startAt, locale) },
    { label: t.to, value: formatDateTime(r.endAt, locale) },
  ];
  if (pricing.place) termRows.push({ label: t.place, value: pricing.place });
  for (const f of PRICING_FIELDS) {
    // "KM libres": el km incluido y el km extra no aplican.
    if (pricing.unlimitedKm && (f.key === "kmPerDay" || f.key === "extraKmRate")) continue;
    const v = pricing[f.key];
    if (typeof v === "number" && !Number.isNaN(v)) {
      const value =
        f.kind === "money" ? formatArs(v) : f.kind === "percent" ? `${v}%` : String(v);
      termRows.push({ label: f.label, value });
    }
  }
  if (pricing.unlimitedKm) {
    termRows.push({ label: t.kmIncluded, value: t.unlimitedKm });
  }
  // Importe de la hora extra derivado del % sobre la tarifa diaria.
  const hourAmount = extraHourAmount(pricing);
  if (hourAmount != null) {
    termRows.push({ label: t.extraHourAmount, value: `${formatArs(hourAmount)} / h` });
  }
  if (pricing.accessoriesDesc?.trim()) {
    termRows.push({ label: t.accessories, value: pricing.accessoriesDesc.trim() });
  }
  if (pricing.guaranteeForm?.trim()) {
    termRows.push({ label: t.guaranteeForm, value: pricing.guaranteeForm.trim() });
  }

  // Comparación con la entrega (solo devolución).
  let comparison: ActaData["comparison"];
  if (inspection.type === "return_") {
    const handover = await prisma.inspection.findFirst({
      where: { rentalId: inspection.rentalId, type: "handover" },
      select: { km: true, fuelLevel: true },
    });
    if (handover) {
      comparison = computeComparison({
        handoverKm: handover.km,
        returnKm: inspection.km,
        handoverFuel: handover.fuelLevel,
        returnFuel: inspection.fuelLevel,
        newDamages: inspection.damages.length,
      });
    }
  }

  const settlement =
    inspection.type === "return_" && inspection.settlement
      ? (inspection.settlement as Settlement)
      : undefined;

  // Conductores autorizados: titular + adicionales cargados en la entrega.
  const extraDrivers = Array.isArray(r.additionalDrivers)
    ? (r.additionalDrivers as { name?: string }[])
        .map((d) => d?.name?.trim())
        .filter((n): n is string => Boolean(n))
    : [];
  const authorizedDrivers = [r.clientName, ...extraDrivers].filter(Boolean);

  const data: ActaData = {
    kind: inspection.type === "handover" ? "handover" : "return",
    dict,
    company: COMPANY,
    comparison,
    settlement,
    dateStr: formatDateTime(inspection.createdAt, locale),
    registeredBy: inspection.user?.name,
    vehicleLabel: `${inspection.vehicle.brand} ${inspection.vehicle.model}`,
    plate: inspection.vehicle.plate,
    clientRows,
    authorizedDrivers: extraDrivers.length > 0 ? authorizedDrivers : undefined,
    termRows,
    km: inspection.km,
    fuelLevel: inspection.fuelLevel,
    fuelLevels: inspection.vehicle.fuelLevels,
    checklist,
    damages: inspection.damages.map((d) => ({ view: d.view, description: d.description, posX: d.posX, posY: d.posY })),
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

  const locale = inspection.rental.language as Locale;
  const { from: fromOverride, content } = await resolveEmailConfig(locale);

  const apiKey = process.env.RESEND_API_KEY;
  const from = fromOverride ?? process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    console.warn("[acta] Resend no configurado — PDF guardado, email omitido");
    return;
  }

  const isHandover = inspection.type === "handover";
  const subject = isHandover ? content.handoverSubject : content.returnSubject;
  const body = isHandover ? content.handoverBody : content.returnBody;

  const to: string[] = [];
  if (inspection.rental.clientEmail) to.push(inspection.rental.clientEmail);
  const admin = process.env.ADMIN_EMAIL;
  if (to.length === 0 && admin) to.push(admin);
  if (to.length === 0) {
    console.warn("[acta] sin destinatario (ni cliente ni admin) — email omitido");
    return;
  }

  const br = (s: string) => s.replace(/\n/g, "<br>");
  const html = `<p>${content.greeting} ${inspection.rental.clientName},</p><p>${br(body)}</p><p>${content.attachmentNote}</p><p>${br(content.regards)}</p>`;

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
