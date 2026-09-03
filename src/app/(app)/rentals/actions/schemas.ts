import { z } from "zod";

export type FormState = {
  error?: string;
  ok?: boolean;
  fieldErrors?: Partial<Record<string, string>>;
  /** El rechazo fue específicamente un choque de fechas con otra reserva
   *  vigente del mismo auto (no "no existe"/"archivado") — se puede
   *  confirmar igual si el empleado ya sabe que va a estar disponible. */
  overlapConfirm?: boolean;
  /** El vehículo que se intentó asignar y disparó `overlapConfirm` — el
   *  <select> lo sigue mostrando en vez de volver al valor anterior. */
  attemptedVehicleId?: string;
  /** Identifica el choque concreto (auto, y fechas cuando son editables en
   *  el mismo form). El form lo reenvía tal cual en `confirmOverlapFor` para
   *  saltear la validación una sola vez — si el empleado cambia el auto o
   *  las fechas después del aviso, esta clave ya no coincide y se vuelve a
   *  validar en vez de arrastrar un "sí" a un choque distinto. Opaca para el
   *  cliente: no la arma, solo la hace ida y vuelta. */
  overlapKey?: string;
};

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
