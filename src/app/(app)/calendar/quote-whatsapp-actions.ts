"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-helpers";
import { displayName } from "@/lib/user-display";
import { prisma } from "@/lib/prisma";
import { formatArs } from "@/lib/contract";
import { vehicleBrandModel } from "@/lib/vehicle-ui";
import { quoteBillableDays, quotePricePerDay } from "@/lib/quote-estimate";
import { buildConditionLines } from "@/lib/condition-lines";
import { renderQuoteMessage } from "@/lib/whatsapp/quote-message";
import { isSessionWindowOpen } from "@/lib/whatsapp/conversations";
import { sendTextMessage } from "@/lib/whatsapp/send";

/** `kind` distingue "avisá al cliente a mano" (sin vincular / ventana cerrada,
 *  aviso ámbar en la UI) de una falla real de envío (rojo). */
export type SendQuoteWhatsAppResult = {
  error?: string;
  kind?: "no_conversation" | "window_closed" | "failed";
  sent?: boolean;
};

const WINDOW_CLOSED_MESSAGE =
  "Pasaron más de 24 horas desde el último mensaje del cliente — no se puede mandar directo desde Andes. Enviá la propuesta por WhatsApp Web o desde el celular.";

/**
 * Manda el presupuesto por WhatsApp a la conversación vinculada, como texto
 * libre — solo funciona dentro de la ventana de 24hs (decisión del dueño: sin
 * plantillas aprobadas por Meta, en la práctica el presupuesto casi siempre
 * se manda con la conversación ya abierta). Abierto a cualquier rol — mandar
 * el mensaje no modifica el presupuesto, mismo criterio que el compositor de
 * `/whatsapp/[id]` (`sendMessage`, requireUser).
 */
export async function sendQuoteWhatsApp(quoteId: string): Promise<SendQuoteWhatsAppResult> {
  const user = await requireUser();

  const quote = await prisma.rentalQuote.findUniqueOrThrow({
    where: { id: quoteId },
    include: { vehicle: { select: { brand: true, model: true } } },
  });

  if (!quote.conversationId) {
    return { error: "Vinculá una conversación de WhatsApp antes de enviar.", kind: "no_conversation" };
  }

  const conversation = await prisma.whatsAppConversation.findUniqueOrThrow({
    where: { id: quote.conversationId },
    select: { lastInboundAt: true },
  });
  if (!isSessionWindowOpen(conversation.lastInboundAt)) {
    return { error: WINDOW_CLOSED_MESSAGE, kind: "window_closed" };
  }

  const [conditions, settings] = await Promise.all([
    prisma.conditionSettings.findUnique({ where: { id: 1 } }),
    prisma.whatsAppSettings.findUnique({ where: { id: 1 } }),
  ]);

  const days = quoteBillableDays(quote.startAt, quote.endAt);
  const total = quote.estimatedTotal != null ? Number(quote.estimatedTotal) : null;
  const perDay = quotePricePerDay(total, days);
  const conditionLines = buildConditionLines(
    conditions
      ? {
          kmPerDay: conditions.kmPerDay,
          extraKmRate: conditions.extraKmRate != null ? Number(conditions.extraKmRate) : null,
          deductible: conditions.deductible != null ? Number(conditions.deductible) : null,
          deductibleReduced: conditions.deductibleReduced != null ? Number(conditions.deductibleReduced) : null,
        }
      : null,
  );

  const message = renderQuoteMessage(settings?.budgetMessageTemplate ?? null, {
    auto: vehicleBrandModel(quote.vehicle),
    dias: String(days),
    precioDia: perDay != null ? formatArs(perDay) : "a confirmar",
    total: total != null ? formatArs(total) : "a confirmar",
    condiciones: conditionLines.length > 0 ? `Condiciones:\n${conditionLines.join("\n")}` : "",
    cliente: quote.clientName ? ` ${quote.clientName}` : "",
  });

  try {
    await sendTextMessage(quote.conversationId, message, user.id, displayName(user));
  } catch {
    return { error: "No se pudo enviar el mensaje. Intentá de nuevo.", kind: "failed" };
  }

  revalidatePath(`/whatsapp/${quote.conversationId}`);
  return { sent: true };
}
