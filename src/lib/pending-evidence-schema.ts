import { z } from "zod";

/**
 * Validación compartida entre `saveHandover`/`saveReturn` y
 * `attachInspectionEvidence` para `PendingEvidenceInput` (ver
 * `src/lib/inspection-input.ts`) — evidencia capturada localmente que
 * todavía no terminó de subir al confirmar la entrega/devolución
 * ("avanzar sin señal").
 */
export const pendingEvidenceItemSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("signature"), localId: z.string().min(1) }),
  z.object({ kind: z.literal("photo"), localId: z.string().min(1) }),
  z.object({ kind: z.literal("video"), localId: z.string().min(1) }),
  z.object({ kind: z.literal("damagePhoto"), localId: z.string().min(1), damageId: z.string().min(1) }),
  z.object({
    kind: z.literal("document"),
    localId: z.string().min(1),
    docKind: z.enum(["license", "dni", "passport"]),
    holderName: z.string().trim().optional(),
  }),
]);

export const pendingEvidenceSchema = z.array(pendingEvidenceItemSchema).optional();
