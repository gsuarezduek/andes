import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyWebhookSignature, parseInboundEvent, parseOutboundEchoEvents } from "@/lib/whatsapp/chakra";

describe("verifyWebhookSignature", () => {
  const secret = "shh-its-a-secret";
  const body = JSON.stringify({ hello: "world" });
  const validSignature = createHmac("sha256", secret).update(body, "utf8").digest("hex");

  it("acepta la firma correcta", () => {
    expect(verifyWebhookSignature(body, validSignature, secret)).toBe(true);
  });

  it("acepta la firma correcta con el prefijo sha256= (tolerancia extra, Chakra no lo usa)", () => {
    expect(verifyWebhookSignature(body, `sha256=${validSignature}`, secret)).toBe(true);
  });

  it("rechaza una firma incorrecta", () => {
    expect(verifyWebhookSignature(body, "0".repeat(64), secret)).toBe(false);
  });

  it("rechaza si no hay header de firma", () => {
    expect(verifyWebhookSignature(body, null, secret)).toBe(false);
  });

  it("rechaza si el body fue alterado", () => {
    expect(verifyWebhookSignature(body + "x", validSignature, secret)).toBe(false);
  });
});

// Formato real (pass-through de Meta), capturado contra una cuenta real de
// Chakra el 2026-09-06 — ver CLAUDE.md v20.
describe("parseInboundEvent", () => {
  it("extrae un mensaje de texto (payload real capturado en producción)", () => {
    const payload = {
      entry: [
        {
          id: "1115147320428113",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { display_phone_number: "5492612306787", phone_number_id: "883576331510395" },
                contacts: [{ profile: { name: "Gastón" }, user_id: "AR.1523879196210702", wa_id: "5492612577987" }],
                messages: [
                  {
                    from: "5492612577987",
                    from_user_id: "AR.1523879196210702",
                    id: "wamid.HBgNNTQ5MjYxMjU3Nzk4NxUCABIYFDNCNkQ3REFCRTg2NjU0NEE2MTVCAA==",
                    timestamp: "1788703888",
                    type: "text",
                    text: { body: "hola oo" },
                  },
                ],
              },
            },
          ],
        },
      ],
      object: "whatsapp_business_account",
    };
    const events = parseInboundEvent(payload);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      waMessageId: "wamid.HBgNNTQ5MjYxMjU3Nzk4NxUCABIYFDNCNkQ3REFCRTg2NjU0NEE2MTVCAA==",
      fromE164: "+5492612577987",
      contactName: "Gastón",
      text: "hola oo",
    });
    expect(events[0].timestamp).toEqual(new Date(1788703888 * 1000));
  });

  it("extrae un mensaje con imagen y caption", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: {
                messages: [
                  {
                    id: "wamid.IMG",
                    from: "5492611234567",
                    timestamp: "1700000001",
                    type: "image",
                    image: { id: "media-1", mime_type: "image/jpeg", caption: "mirá esto" },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const events = parseInboundEvent(payload);
    expect(events).toHaveLength(1);
    expect(events[0].media).toEqual({ mediaId: "media-1", mimeType: "image/jpeg", kind: "image" });
    expect(events[0].text).toBe("mirá esto");
  });

  it("ignora eventos de status de un mensaje saliente (payload real de sent/delivered/read)", () => {
    const payload = {
      entry: [
        {
          id: "1115147320428113",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                metadata: { display_phone_number: "5492612306787", phone_number_id: "883576331510395" },
                contacts: [{ user_id: "AR.1523879196210702", wa_id: "5492612577987" }],
                statuses: [
                  {
                    id: "wamid.STATUS",
                    status: "delivered",
                    timestamp: "1788703905",
                    recipient_id: "5492612577987",
                    recipient_user_id: "AR.1523879196210702",
                    pricing: { billable: false, category: "service", pricing_model: "PMP", type: "free_customer_service" },
                  },
                ],
              },
            },
          ],
        },
      ],
      object: "whatsapp_business_account",
    };
    expect(parseInboundEvent(payload)).toEqual([]);
  });

  it("ignora eventos de sincronización de historial (field:history)", () => {
    const payload = {
      entry: [{ changes: [{ field: "history", value: { history: [{ threads: [] }] } }] }],
    };
    expect(parseInboundEvent(payload)).toEqual([]);
  });

  it("devuelve [] para un payload sin entry", () => {
    expect(parseInboundEvent({})).toEqual([]);
    expect(parseInboundEvent(null)).toEqual([]);
  });
});

// Formato tomado de la referencia oficial de Meta (developers.facebook.com/
// documentation/business-messaging/whatsapp/webhooks/reference/
// smb_message_echoes) — todavía NO verificado contra un payload real
// (Coexistence sin probar en esta cuenta). Ver comentario en chakra.ts.
describe("parseOutboundEchoEvents", () => {
  it("extrae un mensaje de texto mandado a mano desde la app/WhatsApp Web", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              field: "smb_message_echoes",
              value: {
                messaging_product: "whatsapp",
                metadata: { display_phone_number: "5492612306787", phone_number_id: "883576331510395" },
                message_echoes: [
                  {
                    from: "5492612306787",
                    to: "5492612577987",
                    id: "wamid.ECHO1",
                    timestamp: "1788703999",
                    type: "text",
                    text: { body: "te confirmo desde la app" },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const events = parseOutboundEchoEvents(payload);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      waMessageId: "wamid.ECHO1",
      toE164: "+5492612577987",
      text: "te confirmo desde la app",
    });
    expect(events[0].timestamp).toEqual(new Date(1788703999 * 1000));
  });

  it("extrae un eco con imagen y caption", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              field: "smb_message_echoes",
              value: {
                message_echoes: [
                  {
                    from: "5492612306787",
                    to: "5492611234567",
                    id: "wamid.ECHOIMG",
                    timestamp: "1700000002",
                    type: "image",
                    image: { id: "media-echo-1", mime_type: "image/jpeg", caption: "así quedó" },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    const events = parseOutboundEchoEvents(payload);
    expect(events).toHaveLength(1);
    expect(events[0].media).toEqual({ mediaId: "media-echo-1", mimeType: "image/jpeg", kind: "image" });
    expect(events[0].text).toBe("así quedó");
  });

  it("ignora ediciones y borrados (fuera de alcance del MVP)", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              field: "smb_message_echoes",
              value: {
                message_echoes: [
                  { from: "1", to: "2", id: "wamid.EDIT", timestamp: "1700000003", type: "edit" },
                  { from: "1", to: "2", id: "wamid.REVOKE", timestamp: "1700000004", type: "revoke" },
                ],
              },
            },
          ],
        },
      ],
    };
    expect(parseOutboundEchoEvents(payload)).toEqual([]);
  });

  it("ignora un change de mensajes entrantes normales (field distinto)", () => {
    const payload = {
      entry: [{ changes: [{ field: "messages", value: { messages: [{ id: "x", from: "1", timestamp: "1", type: "text", text: { body: "hola" } }] } }] }],
    };
    expect(parseOutboundEchoEvents(payload)).toEqual([]);
  });

  it("devuelve [] para un payload sin entry", () => {
    expect(parseOutboundEchoEvents({})).toEqual([]);
    expect(parseOutboundEchoEvents(null)).toEqual([]);
  });
});
