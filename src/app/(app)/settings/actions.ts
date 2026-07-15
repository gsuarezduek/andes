"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";

/** Entero no negativo, o null si el campo viene vacío. */
function intOrNull(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim();
  if (s === "") return null;
  const n = Math.round(Number(s));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Guarda las condiciones económicas precargadas (plantilla global, singleton
 * id = 1). Son los valores por defecto que el empleado ve en el paso
 * "Condiciones" de la entrega. La hora extra es un % de la tarifa diaria.
 */
export async function saveConditions(formData: FormData) {
  await requireAdmin();
  const data = {
    insuranceAmount: intOrNull(formData.get("insuranceAmount")),
    kmPerDay: intOrNull(formData.get("kmPerDay")),
    extraKmRate: intOrNull(formData.get("extraKmRate")),
    extraHourPercent: intOrNull(formData.get("extraHourPercent")),
  };
  await prisma.conditionSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...data },
    update: data,
  });
  revalidatePath("/settings/general");
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
