import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyWebhookSignature, parseInboundEvent } from "@/lib/whatsapp/chakra";

describe("verifyWebhookSignature", () => {
  const secret = "shh-its-a-secret";
  const body = JSON.stringify({ hello: "world" });
  const validSignature = createHmac("sha256", secret).update(body, "utf8").digest("hex");

  it("acepta la firma correcta", () => {
    expect(verifyWebhookSignature(body, validSignature, secret)).toBe(true);
  });

  it("acepta la firma correcta con el prefijo sha256= (formato Meta nativo)", () => {
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

describe("parseInboundEvent", () => {
  it("extrae un mensaje de texto", () => {
    const payload = {
      entry: [
        {
          id: "waba-1",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                contacts: [{ profile: { name: "Juan Pérez" }, wa_id: "5492611234567" }],
                messages: [
                  { id: "wamid.ABC", from: "5492611234567", timestamp: "1700000000", type: "text", text: { body: "Hola!" } },
                ],
              },
            },
          ],
        },
      ],
    };
    const events = parseInboundEvent(payload);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      waMessageId: "wamid.ABC",
      fromE164: "+5492611234567",
      contactName: "Juan Pérez",
      text: "Hola!",
    });
    expect(events[0].timestamp).toEqual(new Date(1700000000 * 1000));
  });

  it("extrae un mensaje con imagen y caption", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
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

  it("ignora eventos de status (sin campo messages)", () => {
    const payload = {
      entry: [{ changes: [{ value: { statuses: [{ id: "wamid.ABC", status: "delivered" }] } }] }],
    };
    expect(parseInboundEvent(payload)).toEqual([]);
  });

  it("devuelve [] para un payload sin entry", () => {
    expect(parseInboundEvent({})).toEqual([]);
    expect(parseInboundEvent(null)).toEqual([]);
  });
});
