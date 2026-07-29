import { z } from "zod";

export type FormState = { error?: string; ok?: boolean; fieldErrors?: Partial<Record<string, string>> };

/** El primer mensaje de Zod por campo, para resaltar el input puntual que falló. */
export function zodFieldErrors(error: z.ZodError): Partial<Record<string, string>> {
  const out: Partial<Record<string, string>> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !out[field]) out[field] = issue.message;
  }
  return out;
}

export const optionalStr = z.preprocess(
  (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined),
  z.string().optional(),
);

export const rentalSchema = z.object({
  clientName: z.string().trim().min(1, "El nombre del cliente es obligatorio"),
  clientEmail: z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined),
    z.email("Email inválido").optional(),
  ),
  clientPhone: optionalStr,
  clientDocNumber: optionalStr,
  clientAddress: optionalStr,
  vehicleId: optionalStr,
  startAt: z.string().min(1, "La fecha de retiro es obligatoria"),
  endAt: z.string().min(1, "La fecha de devolución es obligatoria"),
  language: z.enum(["es", "en"]),
});

export const updateSchema = z.object({
  rentalId: z.string().min(1),
  clientName: z.string().trim().min(1, "El nombre del cliente es obligatorio"),
  clientEmail: z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : undefined),
    z.email("Email inválido").optional(),
  ),
  clientPhone: optionalStr,
  clientDocNumber: optionalStr,
  clientAddress: optionalStr,
  vehicleId: optionalStr,
});

export const returnSchema = z.object({
  rentalId: z.string().min(1),
  endAt: z.string().min(1, "La fecha de devolución es obligatoria"),
  returnPlace: optionalStr,
});
