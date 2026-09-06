import { NextResponse, type NextRequest } from "next/server";
import { processWhatsAppWebhook } from "@/lib/whatsapp/inbound";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook de Chakra (BSP de WhatsApp): recibe los mensajes entrantes. Sin
 * sesión — excluido del proxy (ver src/proxy.ts) — autenticado por firma
 * HMAC sobre el body crudo (ver src/lib/whatsapp/chakra.ts). Se lee el body
 * como texto para poder verificar la firma contra los bytes exactos que
 * llegaron, antes de parsear el JSON.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-chakra-signature-256");

  // TODO(temporal): sacar este log en cuanto confirmemos el shape real del
  // payload de Chakra contra una cuenta real — ver CLAUDE.md v19.
  console.log("[WA_DEBUG] raw webhook body:", rawBody.slice(0, 3000));

  const verdict = await processWhatsAppWebhook(rawBody, signature);
  console.log("[WA_DEBUG] verdict:", JSON.stringify(verdict));

  if (verdict.status === "not_configured") {
    return NextResponse.json({ error: "no hay cuenta de WhatsApp conectada" }, { status: 503 });
  }
  if (verdict.status === "invalid_signature") {
    return NextResponse.json({ error: "firma inválida" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, processed: verdict.count });
}
