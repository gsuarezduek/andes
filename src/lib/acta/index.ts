import "server-only";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import { prisma } from "@/lib/prisma";
import { storage, actaKey } from "@/lib/storage";
import { getDictionary, type Locale } from "@/lib/i18n";
import { resolveEmailConfig } from "@/lib/email/settings";
import { formatDateTime, formatDate } from "@/lib/datetime";
import {
  COMPANY,
  formatArs,
  PRICING_FIELDS,
  extraHourAmount,
  kmPackAmount,
  usdPaymentDetail,
  type ContractPricing,
} from "@/lib/contract";
import { computeComparison } from "@/lib/comparison";
import type { Settlement } from "@/lib/settlement";
import type { Resend } from "resend";
import { ActaDocument, type ActaData, type ActaRow } from "./pdf";

const MAX_PHOTOS_IN_PDF = 8;

/**
 * Trae un archivo de storage como data URI para embeberlo en el PDF. Si falla
 * la descarga (no si simplemente no había key: eso es normal), lo loguea
 * explícitamente — sin esto, el acta se manda igual pero sin la firma o una
 * foto, y nadie se entera de que hace falta regenerarla.
 */
async function toDataUri(
  key: string | null | undefined,
  context: string,
  inspectionId: string,
): Promise<string | undefined> {
  if (!key) return undefined;
  try {
    const { body, contentType } = await storage().get(key);
    return `data:${contentType};base64,${body.toString("base64")}`;
  } catch (e) {
    console.error(`[acta] no se pudo leer ${context} (inspection ${inspectionId}, key "${key}") — el acta se genera sin ella`, e);
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
    },
  });
  if (!inspection) throw new Error(`inspection ${inspectionId} not found`);

  // Daños activos del auto previos a ESTA inspección (vista superior, para el
  // croquis) — sin esto, si la entrega/devolución no encontró ningún daño
  // NUEVO, el acta no mostraba el dibujo aunque el auto ya tuviera rayones
  // registrados de antes.
  //
  // Ojo: el acta es regenerable en cualquier momento (on-demand, o cuando
  // termina de subir evidencia demorada), y `Damage` es por VEHÍCULO, no por
  // inspección — un daño cargado después (en la devolución de esta misma
  // reserva, o en un alquiler posterior de otro cliente) NO puede aparecer
  // acá. Por eso el filtro es contra el estado del vehículo al momento de
  // ESTA inspección (`createdAt` del daño anterior a la inspección, y todavía
  // sin reparar EN ESE MOMENTO — un daño reparado después de esta inspección
  // pero antes de hoy sigue siendo válido mostrarlo acá).
  const existingDamageRows = await prisma.damage.findMany({
    where: {
      vehicleId: inspection.vehicleId,
      view: "top",
      createdAt: { lt: inspection.createdAt },
      OR: [{ repaired: false }, { repairedAt: { gt: inspection.createdAt } }],
      NOT: { id: { in: inspection.damages.map((d) => d.id) } },
    },
    select: { posX: true, posY: true, description: true },
  });

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
    await Promise.all(
      photoKeys
        .slice(0, MAX_PHOTOS_IN_PDF)
        .map((k) => toDataUri(k, "una foto", inspectionId)),
    )
  ).filter((x): x is string => Boolean(x));
  const signatureDataUri = await toDataUri(inspection.signatureUrl, "la firma", inspectionId);

  const r = inspection.rental;
  const t = dict.acta;

  // Datos del cliente.
  const clientRows: ActaRow[] = [{ label: t.client, value: r.clientName }];
  if (r.clientDocNumber) clientRows.push({ label: t.dni, value: r.clientDocNumber });
  if (r.clientCountry) clientRows.push({ label: t.country, value: r.clientCountry });
  if (r.clientAddress) clientRows.push({ label: t.address, value: r.clientAddress });
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
    if (pricing.unlimitedKm && (f.key === "kmPerDay" || f.key === "extraKmRate" || f.key === "kmPacks"))
      continue;
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
  // Importe total de los packs de KM (el precio por pack no se imprime suelto).
  if (!pricing.unlimitedKm) {
    const packAmount = kmPackAmount(pricing);
    if (packAmount != null) {
      termRows.push({ label: "Packs de KM (importe)", value: formatArs(packAmount) });
    }
  }
  if (pricing.accessoriesDesc?.trim()) {
    termRows.push({ label: t.accessories, value: pricing.accessoriesDesc.trim() });
  }
  // Franquicia (deducible del seguro), con nota si lleva mejora de seguro.
  if (typeof pricing.deductible === "number" && !Number.isNaN(pricing.deductible)) {
    const label = pricing.insuranceUpgrade ? `${t.deductible} (${t.insuranceUpgrade})` : t.deductible;
    termRows.push({ label, value: formatArs(pricing.deductible) });
  }
  if (pricing.guaranteeForm?.trim()) {
    termRows.push({ label: t.guaranteeForm, value: pricing.guaranteeForm.trim() });
  }
  // Medios de pago usados en la entrega (sin la referencia/alias: es interna).
  for (const pay of pricing.payments ?? []) {
    const label =
      (pay.adjustmentPercent
        ? `${pay.methodName} (${pay.adjustmentPercent > 0 ? "+" : ""}${pay.adjustmentPercent}%)`
        : pay.methodName) +
      (pay.note ? ` — ${pay.note}` : "") +
      (usdPaymentDetail(pay) ? ` (${usdPaymentDetail(pay)})` : "");
    termRows.push({ label, value: formatArs(pay.adjustedAmount) });
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
    registeredBy: inspection.userName,
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
    existingDamages: existingDamageRows.map((d) => ({ view: "top", description: d.description, posX: d.posX, posY: d.posY })),
    observations: inspection.observations,
    signerName: inspection.signerName,
    signatureDataUri,
    photoDataUris,
  };

  const element = createElement(ActaDocument, data) as unknown as ReactElement<DocumentProps>;
  return renderToBuffer(element);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type EmailAttempt = { status: "sent" | "failed" | "skipped"; error?: string; sentAt?: Date };

/**
 * Manda un email con el acta adjunta y nunca tira excepción por un rechazo de
 * la API — el SDK de Resend responde `{data:null, error}` en vez de lanzar
 * ante un email inválido/dominio no verificado/rate limit, así que sin este
 * chequeo explícito el fallo queda invisible (ni log, ni excepción).
 */
async function sendActaEmailTo(
  resend: Resend,
  params: { from: string; to: string; subject: string; html: string; pdf: Buffer; filename: string },
): Promise<EmailAttempt> {
  try {
    const { error } = await resend.emails.send({
      from: params.from,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      attachments: [{ filename: params.filename, content: params.pdf }],
    });
    if (error) return { status: "failed", error: error.message ?? JSON.stringify(error) };
    return { status: "sent", sentAt: new Date() };
  } catch (e) {
    return { status: "failed", error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Genera el acta, la guarda en el almacenamiento y envía los emails (async,
 * post-guardado). Regenerable/reenviable en cualquier momento (ver botón
 * "Reenviar" en el detalle del alquiler): cliente y admin se mandan por
 * separado y cada resultado (enviado/falló/omitido) queda en
 * `Inspection.actaClientEmail*`/`actaAdminEmail*` — antes un rechazo de
 * Resend era 100% silencioso.
 */
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
  const isHandover = inspection.type === "handover";
  const filename = `acta-${isHandover ? "entrega" : "devolucion"}-${inspectionId}.pdf`;

  if (!apiKey || !from) {
    console.warn("[acta] Resend no configurado — PDF guardado, email omitido");
    const skipped: EmailAttempt = { status: "skipped", error: "Resend no está configurado (falta API key o remitente)." };
    await prisma.inspection.update({
      where: { id: inspectionId },
      data: {
        actaClientEmailStatus: skipped.status,
        actaClientEmailError: skipped.error,
        actaAdminEmailStatus: skipped.status,
        actaAdminEmailError: skipped.error,
      },
    });
    return;
  }

  const subject = isHandover ? content.handoverSubject : content.returnSubject;
  const body = isHandover ? content.handoverBody : content.returnBody;

  // El admin siempre recibe el acta; el envío al cliente es configurable
  // (Configuración → Condiciones y checklist → Envío de actas).
  const conditions = await prisma.conditionSettings.findUnique({ where: { id: 1 } });
  const sendToClient = isHandover
    ? (conditions?.sendHandoverActa ?? true)
    : (conditions?.sendReturnActa ?? true);

  const br = (s: string) => s.replace(/\n/g, "<br>");
  const html = `<p>${content.greeting} ${inspection.rental.clientName},</p><p>${br(body)}</p><p>${content.attachmentNote}</p><p>${br(content.regards)}</p>`;

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);

  // Cliente y admin se mandan como requests separados a propósito: antes iban
  // en el mismo `to`/`cc`, así que un email de cliente inválido hacía que
  // Resend rechazara el envío ENTERO — el admin tampoco recibía su copia y
  // nadie se enteraba de ninguna de las dos cosas.
  let clientResult: EmailAttempt;
  const clientEmail = inspection.rental.clientEmail;
  if (!sendToClient) {
    clientResult = { status: "skipped", error: "Envío al cliente desactivado en Configuración → Condiciones." };
  } else if (!clientEmail) {
    clientResult = { status: "skipped", error: "La reserva no tiene un email de cliente cargado." };
  } else if (!EMAIL_RE.test(clientEmail)) {
    clientResult = { status: "failed", error: `El email cargado ("${clientEmail}") no tiene un formato válido.` };
  } else {
    clientResult = await sendActaEmailTo(resend, { from, to: clientEmail, subject, html, pdf, filename });
  }

  const admin = process.env.ADMIN_EMAIL;
  let adminResult: EmailAttempt;
  if (!admin) {
    adminResult = { status: "skipped", error: "ADMIN_EMAIL no está configurado." };
  } else {
    adminResult = await sendActaEmailTo(resend, { from, to: admin, subject, html, pdf, filename });
  }

  await prisma.inspection.update({
    where: { id: inspectionId },
    data: {
      actaClientEmailStatus: clientResult.status,
      actaClientEmailError: clientResult.error ?? null,
      actaClientEmailSentAt: clientResult.sentAt ?? null,
      actaAdminEmailStatus: adminResult.status,
      actaAdminEmailError: adminResult.error ?? null,
      actaAdminEmailSentAt: adminResult.sentAt ?? null,
    },
  });

  if (clientResult.status === "failed") {
    console.error(`[acta] envío al cliente falló (inspection ${inspectionId}): ${clientResult.error}`);
  }
  if (adminResult.status === "failed") {
    console.error(`[acta] envío al admin falló (inspection ${inspectionId}): ${adminResult.error}`);
  }
}
