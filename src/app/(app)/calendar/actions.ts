"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-helpers";
import { displayName } from "@/lib/user-display";
import { mendozaWallTimeToUtc } from "@/lib/datetime";
import { createRentalQuote, updateRentalQuote, deleteRentalQuote, type QuoteInput } from "@/lib/rental-quotes";

const DAY_MS = 24 * 60 * 60 * 1000;

function emptyToNull(v: FormDataEntryValue | null): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
}

function parseQuoteForm(formData: FormData): QuoteInput {
  const vehicleId = String(formData.get("vehicleId") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "").trim();
  const days = Math.max(1, Number(formData.get("days") ?? 1) || 1);
  const startAt = mendozaWallTimeToUtc(`${startDate}T00:00`);
  const endAt = new Date(startAt.getTime() + days * DAY_MS);
  const totalRaw = emptyToNull(formData.get("estimatedTotal"));
  const total = totalRaw != null ? Number(totalRaw) : null;
  return {
    vehicleId,
    startAt,
    endAt,
    clientName: emptyToNull(formData.get("clientName")),
    note: emptyToNull(formData.get("note")),
    estimatedTotal: total != null && !Number.isNaN(total) ? total : null,
    conversationId: emptyToNull(formData.get("conversationId")),
  };
}

export async function createQuote(formData: FormData) {
  const user = await requireUser();
  const data = parseQuoteForm(formData);
  await createRentalQuote(data, user.id, displayName(user));
  revalidatePath("/calendar");
}

export async function updateQuote(id: string, formData: FormData) {
  const user = await requireUser();
  const data = parseQuoteForm(formData);
  await updateRentalQuote(id, data, user);
  revalidatePath("/calendar");
}

export async function deleteQuote(id: string) {
  const user = await requireUser();
  await deleteRentalQuote(id, user);
  revalidatePath("/calendar");
}
