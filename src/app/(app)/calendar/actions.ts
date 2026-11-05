"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-helpers";
import { displayName } from "@/lib/user-display";
import { buildQuoteRange } from "@/lib/quote-estimate";
import { createRentalQuote, updateRentalQuote, deleteRentalQuote, type QuoteInput } from "@/lib/rental-quotes";
import { sendQuoteWhatsApp, type SendQuoteWhatsAppResult } from "./quote-whatsapp-actions";

function emptyToNull(v: FormDataEntryValue | null): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
}

function parseQuoteForm(formData: FormData): QuoteInput {
  const vehicleId = String(formData.get("vehicleId") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "").trim();
  const endDate = String(formData.get("endDate") ?? startDate).trim();
  const { startAt, endAt } = buildQuoteRange(
    startDate,
    endDate,
    emptyToNull(formData.get("pickupTime")),
    emptyToNull(formData.get("returnTime")),
  );
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

export type CreateQuoteResult = { id: string; whatsapp?: SendQuoteWhatsAppResult };

/** `send=true` ("Guardar y enviar por WhatsApp") manda el presupuesto a la
 *  conversación vinculada apenas se guarda. Si el envío falla (ventana de
 *  24hs cerrada, error de Chakra) el presupuesto queda guardado igual y el
 *  motivo vuelve en `whatsapp` para mostrarlo en el mismo modal. */
export async function createQuote(formData: FormData, send = false): Promise<CreateQuoteResult> {
  const user = await requireUser();
  const data = parseQuoteForm(formData);
  const quote = await createRentalQuote(data, user.id, displayName(user));
  revalidatePath("/calendar");
  if (!send) return { id: quote.id };
  return { id: quote.id, whatsapp: await sendQuoteWhatsApp(quote.id) };
}

export async function updateQuote(id: string, formData: FormData) {
  const user = await requireUser();
  const data = parseQuoteForm(formData);
  await updateRentalQuote(id, data, user);
  revalidatePath("/calendar");
}

export async function deleteQuote(id: string) {
  await requireUser();
  await deleteRentalQuote(id);
  revalidatePath("/calendar");
}
