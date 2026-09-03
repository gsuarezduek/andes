"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { parseDecimal } from "@/lib/number-input";
import { formatArs } from "@/lib/contract";
import { diffFields } from "@/lib/movement-audit";

const CONDITION_LABELS = {
  kmPerDay: "Km por día",
  extraKmRate: "Km extra",
  extraHourPercent: "Hora extra (%)",
  deductible: "Franquicia/Garantía estándar",
  deductibleReduced: "Franquicia/Garantía con mejora de seguro",
  kmPackPrice: "Precio por pack de KM (autos)",
  kmPackPriceTruck: "Precio por pack de KM (camionetas)",
  sendHandoverActa: "Enviar Acta de Entrega",
  sendReturnActa: "Enviar Acta de Devolución",
  serviceOverdueRedPercent: "Service vencido: % de gracia antes de pasar a rojo",
} as const;

const CONDITION_MONEY_FIELDS = new Set([
  "extraKmRate",
  "deductible",
  "deductibleReduced",
  "kmPackPrice",
  "kmPackPriceTruck",
]);

function formatConditionValue(key: string | number | symbol, v: unknown): string {
  if (v == null || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (CONDITION_MONEY_FIELDS.has(String(key))) return formatArs(Number(v));
  return String(v);
}

/** Entero no negativo, o null si el campo viene vacío. */
function intOrNull(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim();
  if (s === "") return null;
  const n = Math.round(Number(s));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Importe no negativo (acepta coma o punto decimal), o null si viene vacío. */
function moneyOrNull(v: FormDataEntryValue | null): number | null {
  const n = parseDecimal(String(v ?? ""));
  return n !== undefined && n >= 0 ? n : null;
}

/**
 * Guarda las condiciones económicas precargadas (plantilla global, singleton
 * id = 1). Son los valores por defecto que el empleado ve en el paso
 * "Condiciones" de la entrega. La hora extra es un % de la tarifa diaria.
 */
export async function saveConditions(formData: FormData) {
  const user = await requireAdmin();
  const data = {
    kmPerDay: intOrNull(formData.get("kmPerDay")),
    extraKmRate: moneyOrNull(formData.get("extraKmRate")),
    extraHourPercent: intOrNull(formData.get("extraHourPercent")),
    deductible: moneyOrNull(formData.get("deductible")),
    deductibleReduced: moneyOrNull(formData.get("deductibleReduced")),
    kmPackPrice: moneyOrNull(formData.get("kmPackPrice")),
    kmPackPriceTruck: moneyOrNull(formData.get("kmPackPriceTruck")),
    sendHandoverActa: formData.get("sendHandoverActa") === "on",
    sendReturnActa: formData.get("sendReturnActa") === "on",
    serviceOverdueRedPercent: intOrNull(formData.get("serviceOverdueRedPercent")),
  };

  const existing = await prisma.conditionSettings.findUnique({ where: { id: 1 } });
  // Son condiciones económicas que se precargan en cada entrega — un cambio
  // acá afecta a todos los alquileres siguientes en silencio. Queda quién
  // cambió qué y cuándo, mismo criterio que el historial de ediciones de Caja.
  const changes = existing
    ? diffFields(
        {
          kmPerDay: existing.kmPerDay,
          extraKmRate: existing.extraKmRate != null ? Number(existing.extraKmRate) : null,
          extraHourPercent: existing.extraHourPercent,
          deductible: existing.deductible != null ? Number(existing.deductible) : null,
          deductibleReduced: existing.deductibleReduced != null ? Number(existing.deductibleReduced) : null,
          kmPackPrice: existing.kmPackPrice != null ? Number(existing.kmPackPrice) : null,
          kmPackPriceTruck: existing.kmPackPriceTruck != null ? Number(existing.kmPackPriceTruck) : null,
          sendHandoverActa: existing.sendHandoverActa,
          sendReturnActa: existing.sendReturnActa,
          serviceOverdueRedPercent: existing.serviceOverdueRedPercent,
        },
        data,
        CONDITION_LABELS,
        formatConditionValue,
      )
    : [];

  await prisma.$transaction([
    prisma.conditionSettings.upsert({
      where: { id: 1 },
      create: { id: 1, ...data },
      update: data,
    }),
    ...(changes.length > 0
      ? [prisma.conditionSettingsEdit.create({ data: { changes, editedById: user.id } })]
      : []),
  ]);
  revalidatePath("/settings/general");
  redirect("/settings/general?saved=1");
}

/** Texto recortado, o null si el campo viene vacío (→ usa el default del sistema). */
function strOrNull(v: FormDataEntryValue | null): string | null {
  const s = String(v ?? "").trim();
  return s === "" ? null : s;
}

/**
 * Guarda los overrides de los correos transaccionales y la casilla remitente
 * (singleton id = 1). Un campo vacío vuelve al texto por defecto del diccionario
 * i18n. `fromAddress` pisa la env var EMAIL_FROM.
 */
export async function saveEmailSettings(formData: FormData) {
  await requireAdmin();
  const fields = [
    "fromAddress",
    "esHandoverSubject",
    "esReturnSubject",
    "esGreeting",
    "esHandoverBody",
    "esReturnBody",
    "esAttachmentNote",
    "esRegards",
    "enHandoverSubject",
    "enReturnSubject",
    "enGreeting",
    "enHandoverBody",
    "enReturnBody",
    "enAttachmentNote",
    "enRegards",
  ] as const;
  const data = Object.fromEntries(
    fields.map((f) => [f, strOrNull(formData.get(f))]),
  ) as Record<(typeof fields)[number], string | null>;

  await prisma.emailSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...data },
    update: data,
  });
  revalidatePath("/settings/emails");
  redirect("/settings/emails?saved=1");
}

/**
 * Guarda el orden de los autos en el calendario. `orderedIds` es la lista de
 * ids de vehículos en el orden deseado (de arriba hacia abajo); se persiste como
 * `sortOrder = posición` (0, 1, 2, …). Alimenta la vista Calendario.
 */
export async function saveCalendarOrder(orderedIds: string[]): Promise<{ ok: boolean }> {
  await requireAdmin();
  const ids = Array.isArray(orderedIds) ? orderedIds.filter((x) => typeof x === "string") : [];
  if (ids.length === 0) return { ok: false };

  await prisma.$transaction(
    ids.map((id, index) => prisma.vehicle.update({ where: { id }, data: { sortOrder: index } })),
  );
  revalidatePath("/settings/calendar");
  revalidatePath("/calendar");
  return { ok: true };
}
