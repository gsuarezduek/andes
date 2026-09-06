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

// Formato real de Chakra (verificado contra apidocs.chakrahq.com/doc-919167),
// NO el pass-through nativo de Meta que se había asumido en un principio.
describe("parseInboundEvent", () => {
  it("extrae un mensaje de texto", () => {
    const payload = {
      event: "message",
      payload: {
        wabaId: "83784929738012",
        externalId: "wamid.ABC",
        messageId: "wamid.ABC",
        timestamp: 1788259051000,
        message: { from: "5492611234567", type: "text", text: { body: "Hola!" } },
        contacts: [{ profile: { name: "Juan Pérez" }, wa_id: "5492611234567" }],
      },
    };
    const events = parseInboundEvent(payload);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      waMessageId: "wamid.ABC",
      fromE164: "+5492611234567",
      contactName: "Juan Pérez",
      text: "Hola!",
    });
    expect(events[0].timestamp).toEqual(new Date(1788259051000));
  });

  it("extrae un mensaje con imagen y caption", () => {
    const payload = {
      event: "message",
      payload: {
        messageId: "wamid.IMG",
        timestamp: 1788259051000,
        message: { from: "5492611234567", type: "image", image: { id: "media-1", mime_type: "image/jpeg", caption: "mirá esto" } },
      },
    };
    const events = parseInboundEvent(payload);
    expect(events).toHaveLength(1);
    expect(events[0].media).toEqual({ mediaId: "media-1", mimeType: "image/jpeg", kind: "image" });
    expect(events[0].text).toBe("mirá esto");
  });

  it("ignora eventos que no son de mensaje (status, billing, etc.)", () => {
    expect(parseInboundEvent({ event: "status", payload: { status: "delivered" } })).toEqual([]);
  });

  it("devuelve [] para un payload sin la forma esperada", () => {
    expect(parseInboundEvent({})).toEqual([]);
    expect(parseInboundEvent(null)).toEqual([]);
    expect(parseInboundEvent({ event: "message" })).toEqual([]);
  });
});
