import { z } from "zod";

export type FormState = { error?: string; ok?: boolean };

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
